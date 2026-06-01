import { prisma } from '../prisma.js';
import { STAGE_CONFIG, TRACK_ENUM, TRACK_KEY_FROM_ENUM, type TrackKey } from '@dlpe/shared';
import type { Card, Prisma, Track } from '@prisma/client';
import { writeAudit } from './audit.service.js';
import { buildEffectiveForUser } from '../rbac/context.js';
import { filterCard } from '../rbac/applyCardRules.js';
import { visibleCompanyIds } from '../rbac/scope.js';

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

export async function listCards(track?: string, userId?: string): Promise<Card[]> {
  const where: Prisma.CardWhereInput = {};
  if (track) where.track = trackKeyToEnum(track);
  let cards = await prisma.card.findMany({ where, orderBy: { id: 'asc' } });
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
    for (const tr of [...new Set(cards.map((c) => c.track))]) stagesByTrack[tr] = await loadStages(tr);
  }

  return cards.map((c0) => {
    const c = filterCard(c0, eff.effective); // strip/mask restricted fields
    if (autoEscalate) {
      const sla = stagesByTrack[c.track]?.find((s) => s.id === c.stageId)?.sla ?? 0;
      if (sla > 0 && c.days > sla * 2 && c.status !== 'red') {
        return { ...c, status: 'red', escalated: true, daysLabel: `escalated · ${c.days}d in stage` } as Card;
      }
    }
    return c;
  });
}

export async function getCard(id: string, userId?: string): Promise<Card | null> {
  const card = await prisma.card.findUnique({ where: { id } });
  if (!card || !userId) return card;
  // Track + row-level scope: a user can't fetch a card outside their access.
  const allowed = await userAllowedTracks(userId);
  if (!allowed.includes(TRACK_KEY_FROM_ENUM[card.track])) return null;
  const visible = await visibleCompanyIds(userId);
  if (visible && (card.companyId == null || !visible.has(card.companyId))) return null;
  const { effective } = await buildEffectiveForUser(userId);
  return filterCard(card, effective);
}

// Server twin of the frontend `moveStage`: set stageName from StageConfig,
// reset days=0 / daysLabel='moved now', and write an audit entry.
export async function moveStage(
  id: string,
  stageId: string,
  actor: { name: string; roleId: string },
  userId?: string,
): Promise<Card> {
  const card = await prisma.card.findUnique({ where: { id } });
  if (!card) throw new Error('Card not found');

  const trackKey = TRACK_KEY_FROM_ENUM[card.track] as TrackKey;
  const stages = await loadStages(card.track);
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

  const updated = await prisma.card.update({
    where: { id },
    data: {
      stageId,
      stageName,
      days: 0,
      daysLabel: 'moved now',
      cta: stage?.cta ?? card.cta,
    },
  });

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
  // Only allow mutating known mutable columns.
  const data: Prisma.CardUpdateInput = {};
  const allowed: (keyof Card)[] = [
    'type', 'customer', 'value', 'vehicle', 'sub', 'stageId', 'stageName',
    'days', 'daysLabel', 'owner', 'status', 'cta', 'sources', 'awaitingSign', 'meta',
  ];
  for (const key of allowed) {
    if (patch[key] !== undefined) (data as Record<string, unknown>)[key] = patch[key];
  }
  return prisma.card.update({ where: { id }, data });
}
