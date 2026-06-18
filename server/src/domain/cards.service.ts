import { prisma } from '../prisma.js';
import { STAGE_CONFIG, TRACK_ENUM, TRACK_KEY_FROM_ENUM, type TrackKey, type CardDTO as Card } from '@dlpe/shared';
import type { Prisma, Track } from '@prisma/client';
import { writeAudit } from './audit.service.js';
import { buildEffectiveForUser } from '../rbac/context.js';
import { filterCard } from '../rbac/applyCardRules.js';
import { visibleCompanyIds } from '../rbac/scope.js';
import { entityToCardDTO, type EntityRow } from './projection.js';
import { loadTenantResolver, DEMO_TENANT_ID } from './tenancy.js';

// Phase 1b: Entity is the source of truth for pipeline items. Load pipeline
// entities (optionally one track) and project them to the legacy Card shape so
// the rest of this module keeps operating on Card-shaped objects unchanged.
export async function loadPipelineCards(trackKey?: string, tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<Card[]> {
  const where: Prisma.EntityWhereInput = { entityType: { kind: 'pipeline' } };
  if (trackKey) where.trackId = trackKey;
  const rows = await tx.entity.findMany({ where, orderBy: { id: 'asc' } });
  return rows.map((e) => entityToCardDTO(e as unknown as EntityRow) as unknown as Card);
}

export function trackKeyToEnum(track: string): Track {
  const e = TRACK_ENUM[track.toLowerCase()];
  if (!e) throw new Error(`Unknown track: ${track}`);
  return e as Track;
}

const ALL_TRACKS = ['sales', 'operations', 'workshop', 'finance'];

// role.tracks holds human labels ("All tracks", "Sales", "Workshop (read)", …).
// Parse them into the set of track keys the role may VIEW.
export function allowedFromTracksText(tracksArr: string[]): string[] {
  const out = new Set<string>();
  for (const t of tracksArr) {
    const s = String(t).toLowerCase();
    if (s.startsWith('all')) { ALL_TRACKS.forEach((k) => out.add(k)); continue; }
    for (const k of ALL_TRACKS) if (s.includes(k)) out.add(k);
  }
  return [...out];
}

// Union of track keys the user may view across primary + secondary roles.
export async function userAllowedTracks(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { secondary: true } });
  if (!user) return ALL_TRACKS;
  const roleIds = Array.from(new Set([user.roleId, ...user.secondary.map((s) => s.roleId).filter((r): r is string => !!r)]));
  const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });
  const set = new Set<string>();
  for (const r of roles) allowedFromTracksText(r.tracks).forEach((k) => set.add(k));
  return [...set];
}

export interface StageDef { id: string; label: string; sla: number; lock: string | null; cta: string }

// Load the ordered stage set for a track from the DB (admin-editable), falling
// back to the static shared STAGE_CONFIG if none persisted. This makes Stage
// Config editor changes (labels / SLA / lock) actually drive runtime behavior.
export async function loadStages(trackEnum: Track): Promise<StageDef[]> {
  const rows = await prisma.stageConfig.findMany({ where: { track: trackEnum }, orderBy: { order: 'asc' } });
  if (rows.length) return rows.map((r) => ({ id: r.stageId, label: r.label, sla: r.sla, lock: r.lock, cta: r.cta }));
  const key = TRACK_KEY_FROM_ENUM[trackEnum] as TrackKey;
  return ((STAGE_CONFIG[key] ?? []) as unknown) as StageDef[];
}

export async function listCards(track?: string, userId?: string, tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<Card[]> {
  let cards = await loadPipelineCards(track, tx);
  if (!userId) return cards;

  // Functional access: hide tracks the caller's role(s) cannot view.
  const allowed = await userAllowedTracks(userId);
  cards = cards.filter((c) => allowed.includes(TRACK_KEY_FROM_ENUM[c.track]));

  // Row-level scope: hide companies outside the caller's scope (null = all).
  const visible = await visibleCompanyIds(userId);
  if (visible) cards = cards.filter((c) => c.companyId != null && visible.has(c.companyId));

  // Per-caller: field-level RBAC (always) + auto-escalate (if the pref is on).
  const [pref, eff] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId } }),
    buildEffectiveForUser(userId),
  ]);
  const autoEscalate = (pref?.prefs as { autoEscalate?: boolean } | null)?.autoEscalate ?? true;

  // Preload DB stage config (admin-editable SLAs) for the tracks present.
  const stagesByTrack: Partial<Record<Track, StageDef[]>> = {};
  if (autoEscalate) {
    for (const tr of [...new Set(cards.map((c) => c.track))] as Track[]) stagesByTrack[tr] = await loadStages(tr);
  }

  return cards.map((c0) => {
    const c = filterCard(c0, eff.effective); // strip/mask restricted fields
    if (autoEscalate) {
      const sla = stagesByTrack[c.track as Track]?.find((s) => s.id === c.stageId)?.sla ?? 0;
      if (sla > 0 && c.days > sla * 2 && c.status !== 'red') {
        return { ...c, status: 'red', escalated: true, daysLabel: `escalated · ${c.days}d in stage` } as Card;
      }
    }
    return c;
  });
}

export async function getCard(id: string, userId?: string): Promise<Card | null> {
  const row = await prisma.entity.findUnique({ where: { id } });
  if (!row) return null;
  const card = entityToCardDTO(row as unknown as EntityRow) as unknown as Card;
  if (!userId) return card;
  // Track + row-level scope: a user can't fetch a card outside their access.
  const allowed = await userAllowedTracks(userId);
  if (!allowed.includes(TRACK_KEY_FROM_ENUM[card.track])) return null;
  const visible = await visibleCompanyIds(userId);
  if (visible && (card.companyId == null || !visible.has(card.companyId))) return null;
  const { effective } = await buildEffectiveForUser(userId);
  return filterCard(card, effective);
}

// Translate a legacy Card-field patch into an Entity update (envelope columns +
// merged fields JSON). type/vehicle/meta live in fields; the rest are columns.
export function cardPatchToEntityData(
  patch: Partial<Card>,
  existingFields: Record<string, unknown> | null | undefined,
): Prisma.EntityUpdateInput {
  const data: Record<string, unknown> = {};
  const fields: Record<string, unknown> = { ...(existingFields ?? {}) };
  let touchedFields = false;
  const colMap: Record<string, string> = {
    customer: 'title', value: 'value', owner: 'owner', status: 'status', sub: 'sub',
    sources: 'sources', stageId: 'stageId', stageName: 'stageName', days: 'days',
    daysLabel: 'daysLabel', cta: 'cta', awaitingSign: 'awaitingSign',
  };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k in colMap) data[colMap[k]] = v;
    else if (k === 'type' || k === 'vehicle' || k === 'meta') { fields[k] = v; touchedFields = true; }
  }
  if (touchedFields) data.fields = fields;
  return data as Prisma.EntityUpdateInput;
}

// Server twin of the frontend `moveStage`: set stageName from StageConfig,
// reset days=0 / daysLabel='moved now', and write an audit entry.
export async function moveStage(
  id: string,
  stageId: string,
  actor: { name: string; roleId: string },
  userId?: string,
): Promise<Card> {
  const row = await prisma.entity.findUnique({ where: { id } });
  if (!row) throw new Error('Card not found');
  const card = entityToCardDTO(row as unknown as EntityRow) as unknown as Card;

  const trackKey = TRACK_KEY_FROM_ENUM[card.track] as TrackKey;
  const stages = await loadStages(card.track as Track);
  const stage = stages.find((s) => s.id === stageId);
  const stageName = stage?.label ?? stageId;

  // Stage-lock enforcement: when the acting user has "Enforce stage locks" on
  // (the default), block a forward jump into a stage whose lock prerequisite
  // hasn't been reached. Moving backward / one step forward stays allowed.
  if (userId && stage?.lock) {
    const pref = await prisma.userPreference.findUnique({ where: { userId } });
    const enforce = (pref?.prefs as { enforceLocks?: boolean } | null)?.enforceLocks ?? true;
    if (enforce) {
      const orderOf = (sid: string) => stages.findIndex((s) => s.id === sid);
      const lockOrder = orderOf(stage.lock);
      const curOrder = orderOf(card.stageId);
      const tgtOrder = orderOf(stageId);
      if (lockOrder !== -1 && tgtOrder > curOrder && curOrder < lockOrder) {
        const lockStage = stages.find((s) => s.id === stage.lock);
        throw new Error(
          `Stage locked — complete "${lockStage?.label ?? stage.lock}" first. Turn off "Enforce stage locks" in Settings to override.`,
        );
      }
    }
  }

  const updatedRow = await prisma.entity.update({
    where: { id },
    data: {
      stageId,
      stageName,
      days: 0,
      daysLabel: 'moved now',
      cta: stage?.cta ?? card.cta,
    },
  });
  const updated = entityToCardDTO(updatedRow as unknown as EntityRow) as unknown as Card;

  await writeAudit({
    actor: actor.name,
    actorRole: actor.roleId,
    verb: 'moved stage',
    target: `${card.customer} · → ${stageName}`,
    track: trackKey,
    kind: 'normal',
    icon: 'arrow',
    meta: {
      cardId: card.id,
      prevStageId: card.stageId,
      prevStageName: card.stageName,
      prevCta: card.cta,
    },
  });

  return updated;
}

export async function patchCard(id: string, patch: Partial<Card>): Promise<Card> {
  const row = await prisma.entity.findUnique({ where: { id } });
  if (!row) throw new Error('Card not found');
  const data = cardPatchToEntityData(patch, (row.fields ?? {}) as Record<string, unknown>);
  const updated = await prisma.entity.update({ where: { id }, data });
  return entityToCardDTO(updated as unknown as EntityRow) as unknown as Card;
}

const PIPELINE_TYPE_KEY: Record<string, string> = {
  sales: 'contract', operations: 'operation', workshop: 'workshop_order', finance: 'invoice',
};

export interface CreateCardInput {
  track: string; type?: string; customer: string; value?: number | null; vehicle?: string | null;
  sub?: string; stageId?: string; owner?: string; status?: string; companyId?: string | null;
}

// Create a new pipeline entity (a deal/job/invoice/etc) from the UI.
export async function createCard(
  input: CreateCardInput,
  actor: { name: string; roleId: string; userId?: string },
): Promise<Card> {
  const trackKey = input.track.toLowerCase();
  const typeKey = PIPELINE_TYPE_KEY[trackKey];
  if (!typeKey) throw new Error(`Unknown track: ${input.track}`);
  const type = await prisma.entityType.findUnique({ where: { key: typeKey } });
  if (!type) throw new Error(`No entity type for track ${trackKey}`);
  if (!input.customer?.trim()) throw new Error('A title/customer is required');

  const tenantForRaw = await loadTenantResolver(prisma);
  const tenantFor = (companyId: string | null): string => tenantForRaw(companyId) ?? DEMO_TENANT_ID;
  const stages = await loadStages(trackKeyToEnum(trackKey));
  const stage = stages.find((s) => s.id === input.stageId) ?? stages[0];
  const id = `e-${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}`;

  const created = await prisma.entity.create({
    data: {
      id,
      tenantId: tenantFor(input.companyId ?? null),
      entityTypeId: type.id,
      companyId: input.companyId ?? null,
      title: input.customer,
      value: input.value ?? null,
      owner: input.owner ?? actor.name,
      status: input.status ?? 'green',
      sub: input.sub ?? '',
      sources: [],
      fields: { type: input.type ?? 'NEW', vehicle: input.vehicle ?? null, meta: null },
      trackId: trackKey,
      stageId: stage?.id ?? 'lead',
      stageName: stage?.label ?? '',
      days: 0,
      daysLabel: 'created now',
      cta: stage?.cta ?? '',
      awaitingSign: false,
      createdById: actor.userId ?? null,
    },
  });
  await writeAudit({
    actor: actor.name, actorRole: actor.roleId, verb: 'created item',
    target: `${created.title}${created.value ? ' · €' + created.value.toLocaleString() : ''}`,
    track: trackKey, kind: 'normal', icon: 'plus',
  });
  return entityToCardDTO(created as unknown as EntityRow) as unknown as Card;
}

// Delete any entity (pipeline item or reference record).
export async function deleteCard(id: string, actor: { name: string; roleId: string }): Promise<void> {
  const row = await prisma.entity.findUnique({ where: { id } });
  if (!row) throw new Error('Item not found');
  await prisma.entity.delete({ where: { id } });
  await writeAudit({
    actor: actor.name, actorRole: actor.roleId, verb: 'deleted item',
    target: row.title, track: row.trackId ?? 'sales', kind: 'normal', icon: 'close',
  });
}
