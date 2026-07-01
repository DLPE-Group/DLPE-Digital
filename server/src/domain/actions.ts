import type { CardDTO as Card } from '@dlpe/shared';
import type { Prisma } from '@prisma/client';
import { runTriggers } from './triggers.engine.js';
import { writeAudit, type CascadeLine } from './audit.service.js';
import { entityToCardDTO, type EntityRow } from './projection.js';
import { cardPatchToEntityData } from './cards.service.js';

export type ActionName =
  | 'sendFollowUp'
  | 'signContract'
  | 'planWorkshopVisit'
  | 'generateInvoice'
  | 'sendDunning'
  | 'approvePeppol'
  | 'notifyPickup';

export interface RunActionResult {
  card: Card;
  cascades: CascadeLine[];
  createdCards: Card[];
}

type PatchFn = (card: Card, state: Record<string, unknown>) => Partial<Card>;

// onPatch ports from app/src/action_flows.jsx — one per flow.
const PATCHES: Record<ActionName, PatchFn> = {
  sendFollowUp: () => ({ status: 'amber', daysLabel: 'just now', days: 0 }),
  signContract: () => ({
    stageId: 'signed',
    stageName: 'Signed',
    status: 'green',
    daysLabel: 'signed now',
    cta: 'Open in CRM',
    awaitingSign: false,
  }),
  planWorkshopVisit: () => ({
    stageId: 'replacement',
    stageName: 'Contact fleet operator with date',
    status: 'green',
    daysLabel: 'scheduled now',
  }),
  generateInvoice: () => ({
    stageId: 'awaiting',
    stageName: 'Awaiting payment',
    status: 'green',
    daysLabel: 'sent now',
    cta: 'View invoice',
  }),
  sendDunning: (_card, state) =>
    state.level === 'collections'
      ? {
          stageId: 'paid',
          stageName: 'In collections',
          status: 'amber',
          daysLabel: 'handed off',
          cta: 'View collections file',
        }
      : { daysLabel: 'notice sent now', cta: 'Awaiting response' },
  approvePeppol: () => ({
    stageId: 'invoiced',
    stageName: 'Invoice approved',
    status: 'green',
    daysLabel: 'approved now',
    cta: 'View in Finance',
  }),
  notifyPickup: () => ({
    stageName: 'Awaiting pickup confirmation',
    daysLabel: 'notified now',
    cta: 'Mark as collected',
  }),
};

// resolveFlow port: decide which action a card maps to by default (for validation).
export function resolveAction(card: Card): ActionName {
  if (card.id === 's5' && card.stageId !== 'signed') return 'signContract';
  if (card.id === 'f2') return 'sendDunning';
  if (card.id === 'w4') return 'approvePeppol';
  if (card.id === 'o3') return 'planWorkshopVisit';
  if (card.id === 'o5' || card.stageId === 'pickup') return 'notifyPickup';
  if (card.type === 'INVOICE' && card.stageId === 'to_make') return 'generateInvoice';
  if (card.stageId === 'to_make') return 'generateInvoice';
  return 'sendFollowUp';
}

// Actions whose patch fires a cross-track cascade via the trigger engine.
const CASCADING: Partial<Record<ActionName, { whenStageName: string }>> = {
  signContract: { whenStageName: 'Contract signed' },
  approvePeppol: { whenStageName: 'PEPPOL invoice received' },
};

export async function runAction(
  cardId: string,
  action: ActionName,
  state: Record<string, unknown>,
  actor: { name: string; roleId: string },
  tenantId: string,
  db: Prisma.TransactionClient,
): Promise<RunActionResult> {
  if (!PATCHES[action]) throw new Error(`Unknown action: ${action}`);

  const cascadeCfg = CASCADING[action];

  if (cascadeCfg) {
    // db is already a withTenant transaction client — run statements directly (no nested tx).
    const sourceRow = await db.entity.findUnique({ where: { id: cardId } });
    if (!sourceRow) throw new Error('Card not found');
    const source = entityToCardDTO(sourceRow as unknown as EntityRow) as unknown as Card;

    const patch = PATCHES[action](source, state);
    const updatedRow = await db.entity.update({
      where: { id: cardId },
      data: cardPatchToEntityData(patch as Partial<Card>, (sourceRow.fields ?? {}) as Record<string, unknown>),
    });
    const card = entityToCardDTO(updatedRow as unknown as EntityRow) as unknown as Card;

    const whenTrack = source.track;
    const { createdCards, cascadeLines } = await runTriggers(db, {
      whenTrack,
      whenStageName: cascadeCfg.whenStageName,
      sourceCard: card,
      actor,
    }, tenantId);

    // The Brussels sign cascade also touches the customer portal (3rd line).
    const cascades: CascadeLine[] = [...cascadeLines];
    if (action === 'signContract') {
      cascades.push({ track: 'sales', text: `Customer portal updated · order confirmed` });
    }

    await writeAudit(
      {
        actor: actor.name,
        actorRole: actor.roleId,
        verb: action === 'signContract' ? 'marked contract signed' : 'approved PEPPOL invoice',
        target:
          action === 'signContract'
            ? `${card.customer} · ${card.value ? '€' + (card.value / 1e6).toFixed(2) + 'M' : ''} renewal`.trim()
            : `${card.customer} · ${card.vehicle ?? ''}`.trim(),
        track: whenTrack,
        kind: 'critical',
        icon: 'bolt',
        cascades,
        // Record the ids the cascade created so a revert can remove exactly
        // those (the engine's ids are dynamic, not a fixed o1/f1).
        meta: { createdCardIds: createdCards.map((c) => c.id) },
      },
      db,
      tenantId,
    );

    return { card, cascades, createdCards };
  }

  // Non-cascading action: patch + audit — run directly on the caller's tenant tx (db).
  const sourceRow = await db.entity.findUnique({ where: { id: cardId } });
  if (!sourceRow) throw new Error('Card not found');
  const source = entityToCardDTO(sourceRow as unknown as EntityRow) as unknown as Card;
  const patch = PATCHES[action](source, state);
  const updatedRow = await db.entity.update({
    where: { id: cardId },
    data: cardPatchToEntityData(patch as Partial<Card>, (sourceRow.fields ?? {}) as Record<string, unknown>),
  });
  const card = entityToCardDTO(updatedRow as unknown as EntityRow) as unknown as Card;

  await writeAudit({
    actor: actor.name,
    actorRole: actor.roleId,
    verb: actionVerb(action),
    target: `${card.customer}${card.vehicle ? ' · ' + card.vehicle : ''}`,
    track: card.track,
    kind: 'normal',
    icon: 'mail',
  }, db, tenantId);

  return { card, cascades: [], createdCards: [] };
}

function actionVerb(action: ActionName): string {
  switch (action) {
    case 'sendFollowUp':
      return 'sent follow-up email';
    case 'planWorkshopVisit':
      return 'scheduled workshop visit';
    case 'generateInvoice':
      return 'generated invoice';
    case 'sendDunning':
      return 'sent dunning notice';
    case 'notifyPickup':
      return 'notified fleet operator';
    default:
      return 'ran action';
  }
}
