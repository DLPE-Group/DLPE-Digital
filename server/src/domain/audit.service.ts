import { prisma } from '../prisma.js';
import type { Prisma } from '@prisma/client';
import { DEMO_TENANT_ID } from './tenancy.js';

export interface CascadeLine {
  track: string;
  text: string;
}

export interface WriteAuditInput {
  actor: string;
  actorRole?: string;
  verb: string;
  target?: string;
  track: string;
  kind?: string;
  icon?: string;
  isSystem?: boolean;
  day?: string;
  time?: string;
  cascades?: CascadeLine[];
  meta?: Prisma.InputJsonValue;
}

function nowParts() {
  const d = new Date();
  const day = `Today · ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return { day, time };
}

export async function writeAudit(input: WriteAuditInput, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const { day, time } = nowParts();
  return client.auditEntry.create({
    data: {
      day: input.day ?? day,
      time: input.time ?? time,
      actor: input.actor,
      actorRole: input.actorRole,
      verb: input.verb,
      target: input.target,
      track: input.track,
      kind: input.kind ?? 'normal',
      icon: input.icon,
      isSystem: input.isSystem ?? false,
      meta: input.meta ?? undefined,
      tenantId: DEMO_TENANT_ID,
      cascades: input.cascades
        ? { create: input.cascades.map((c, i) => ({ order: i, track: c.track, text: c.text, tenantId: DEMO_TENANT_ID })) }
        : undefined,
    },
    include: { cascades: { orderBy: { order: 'asc' } } },
  });
}

// filter ∈ all | cascades | system | sales | operations | workshop | finance
export async function listAudit(filter = 'all') {
  const entries = await prisma.auditEntry.findMany({
    include: { cascades: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  if (filter === 'all') return entries;
  if (filter === 'cascades') return entries.filter((e) => e.cascades.length > 0);
  if (filter === 'system') return entries.filter((e) => e.isSystem);
  return entries.filter((e) => e.track === filter);
}

export interface RevertResult {
  reverted: boolean;
  removedCardIds: string[];
  restoredCardId: string | null;
}

// Ids the Brussels sign cascade creates (mirrors triggers.engine.ts).
const SIGN_CASCADE_CARD_IDS = ['o1', 'f1'];

export class RevertError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

// Revert an audit entry transactionally.
// - sign cascade: delete o1/f1, reset s5 to the awaiting-signature contract state.
// - stage move: restore the prior stage if recorded in meta, else 422.
export async function revertAudit(
  auditId: string,
  actor: { name: string; roleId: string },
): Promise<RevertResult> {
  const full = await prisma.auditEntry.findUnique({
    where: { id: auditId },
    include: { cascades: { orderBy: { order: 'asc' } } },
  });
  if (!full) throw new RevertError('Audit entry not found', 404);

  const verb = full.verb.toLowerCase();
  const isSignCascade = verb.includes('contract signed') && full.cascades.length > 0;

  if (isSignCascade) {
    return prisma.$transaction(async (tx) => {
      const removedCardIds: string[] = [];
      for (const id of SIGN_CASCADE_CARD_IDS) {
        const existing = await tx.entity.findUnique({ where: { id } });
        if (existing) {
          await tx.entity.delete({ where: { id } });
          removedCardIds.push(id);
        }
      }

      // Reset the source deal (Brussels s5) back to the awaiting-signature state.
      let restoredCardId: string | null = null;
      const source = await tx.entity.findUnique({ where: { id: 's5' } });
      if (source) {
        await tx.entity.update({
          where: { id: 's5' },
          data: {
            stageId: 'contract',
            stageName: 'Contract',
            status: 'green',
            awaitingSign: true,
            cta: 'Mark contract signed',
            daysLabel: 'reverted now',
          },
        });
        restoredCardId = 's5';
      }

      await writeAudit(
        {
          actor: actor.name,
          actorRole: actor.roleId,
          verb: 'reverted contract signature',
          target: full.target ?? undefined,
          track: full.track,
          kind: 'critical',
          icon: 'undo',
          cascades: [
            { track: 'operations', text: 'Removed card · "Vehicle ordered"' },
            { track: 'finance', text: 'Removed card · "Invoice to create"' },
          ],
        },
        tx,
      );

      return { reverted: true, removedCardIds, restoredCardId };
    });
  }

  // Stage-move revert: requires prior stage recorded in meta.
  if (verb.includes('moved stage')) {
    const meta = (full.meta ?? {}) as { cardId?: string; prevStageId?: string; prevStageName?: string; prevCta?: string };
    if (!meta.cardId || !meta.prevStageId) {
      throw new RevertError('This stage move cannot be reverted (no prior stage recorded).');
    }
    return prisma.$transaction(async (tx) => {
      const card = await tx.entity.findUnique({ where: { id: meta.cardId } });
      if (!card) throw new RevertError('Card to revert no longer exists.');
      await tx.entity.update({
        where: { id: meta.cardId },
        data: {
          stageId: meta.prevStageId!,
          stageName: meta.prevStageName ?? meta.prevStageId!,
          cta: meta.prevCta ?? card.cta,
          daysLabel: 'reverted now',
        },
      });
      await writeAudit(
        {
          actor: actor.name,
          actorRole: actor.roleId,
          verb: 'reverted stage move',
          target: `${card.title} · → ${meta.prevStageName ?? meta.prevStageId}`,
          track: full.track,
          kind: 'normal',
          icon: 'undo',
        },
        tx,
      );
      return { reverted: true, removedCardIds: [], restoredCardId: meta.cardId! };
    });
  }

  throw new RevertError('This audit entry is not revertible.');
}
