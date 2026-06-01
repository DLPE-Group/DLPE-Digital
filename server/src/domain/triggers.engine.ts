import type { Card, Prisma } from '@prisma/client';
import { trackKeyToEnum } from './cards.service.js';

export interface RunTriggersInput {
  whenTrack: string; // lowercase track key e.g. 'sales'
  whenStageName: string; // e.g. 'Contract signed'
  sourceCard: Card;
  actor: { name: string; roleId: string };
}

export interface RunTriggersResult {
  createdCards: Card[];
  cascadeLines: { track: string; text: string }[];
}

// Deterministic ids for the seeded Brussels cascade so re-signing never duplicates.
const BRUSSELS_OPS_ID = 'o1';
const BRUSSELS_FIN_ID = 'f1';

// Derive the downstream card payload for a given trigger row + source card.
function buildCardForTrigger(
  tx: Prisma.TransactionClient,
  trigger: { thenTrack: string; thenStage: string; note: string },
  source: Card,
): { id?: string; data: Prisma.CardCreateInput } | null {
  const then = trigger.thenTrack;

  // --- Brussels cascade (sales · Contract signed) ---
  if (then === 'operations' && trigger.thenStage === 'Vehicle ordered') {
    return {
      id: BRUSSELS_OPS_ID,
      data: {
        id: BRUSSELS_OPS_ID,
        track: 'OPERATIONS',
        type: 'DELIVERY',
        customer: source.customer,
        value: null,
        vehicle: 'Fleet · 78 vehicles',
        sub: 'Master order · auto-created on signature',
        stageId: 'ordered',
        stageName: 'Vehicle ordered',
        days: 0,
        daysLabel: 'day 0 of 90',
        owner: 'Tom Janssens',
        status: 'green',
        cta: 'Confirm with supplier',
        sources: ['API', 'Talend'],
        awaitingSign: false,
        company: source.companyId ? { connect: { id: source.companyId } } : undefined,
      },
    };
  }
  if (then === 'finance' && trigger.thenStage === 'Invoice to create') {
    return {
      id: BRUSSELS_FIN_ID,
      data: {
        id: BRUSSELS_FIN_ID,
        track: 'FINANCE',
        type: 'INVOICE',
        customer: source.customer,
        value: source.value ?? 2460000,
        vehicle: null,
        sub: 'Master invoice · first delivery',
        stageId: 'to_make',
        stageName: 'Invoice to create',
        days: 0,
        daysLabel: 'day 0',
        owner: 'Ines Vandeput',
        status: 'amber',
        cta: 'Generate invoice',
        sources: ['API'],
        awaitingSign: false,
        company: source.companyId ? { connect: { id: source.companyId } } : undefined,
      },
    };
  }

  // --- Workshop → Finance (approve PEPPOL supplier invoice) ---
  if (then === 'finance' && trigger.thenStage === 'Supplier invoice received') {
    return {
      id: undefined, // generated id; not a fixed seed card
      data: {
        id: `f-${source.id}-supplier`,
        track: 'FINANCE',
        type: 'SUPPLIER',
        customer: source.customer,
        value: source.value ?? null,
        vehicle: source.vehicle,
        sub: 'Approved supplier invoice · routed from workshop',
        stageId: 'supplier',
        stageName: 'Supplier invoice received',
        days: 0,
        daysLabel: 'received now',
        owner: 'Ines Vandeput',
        status: 'green',
        cta: 'Approve for payment',
        sources: ['PEPPOL'],
        awaitingSign: false,
        company: source.companyId ? { connect: { id: source.companyId } } : undefined,
      },
    };
  }

  return null;
}

// Config-driven: reads CrossTrigger rows and creates downstream cards.
export async function runTriggers(
  tx: Prisma.TransactionClient,
  input: RunTriggersInput,
): Promise<RunTriggersResult> {
  const triggers = await tx.crossTrigger.findMany({
    where: { whenTrack: input.whenTrack, whenStage: input.whenStageName },
  });

  const createdCards: Card[] = [];
  const cascadeLines: { track: string; text: string }[] = [];

  for (const trigger of triggers) {
    const spec = buildCardForTrigger(tx, trigger, input.sourceCard);
    if (!spec) continue;

    const fixedId = spec.data.id as string;
    // Guard: do not duplicate a deterministic card if it already exists.
    const existing = await tx.card.findUnique({ where: { id: fixedId } });
    const card = existing ?? (await tx.card.create({ data: spec.data }));
    createdCards.push(card);

    cascadeLines.push({
      track: trigger.thenTrack,
      text:
        trigger.thenTrack === 'finance'
          ? `Created card · "${card.stageName} · ${card.value ? '€' + card.value.toLocaleString() : ''}"`.trim()
          : `Created card · "${card.stageName} · ${card.vehicle ?? ''}"`.trim(),
    });
  }

  return { createdCards, cascadeLines };
}

export { BRUSSELS_OPS_ID, BRUSSELS_FIN_ID, trackKeyToEnum };
