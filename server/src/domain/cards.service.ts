import { prisma } from '../prisma.js';
import { STAGE_CONFIG, TRACK_ENUM, TRACK_KEY_FROM_ENUM, type TrackKey } from '@dlpe/shared';
import type { Card, Prisma, Track } from '@prisma/client';
import { writeAudit } from './audit.service.js';

export function trackKeyToEnum(track: string): Track {
  const e = TRACK_ENUM[track.toLowerCase()];
  if (!e) throw new Error(`Unknown track: ${track}`);
  return e as Track;
}

export async function listCards(track?: string): Promise<Card[]> {
  const where: Prisma.CardWhereInput = {};
  if (track) where.track = trackKeyToEnum(track);
  return prisma.card.findMany({ where, orderBy: { id: 'asc' } });
}

export async function getCard(id: string): Promise<Card | null> {
  return prisma.card.findUnique({ where: { id } });
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
  const stages = STAGE_CONFIG[trackKey] ?? [];
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
