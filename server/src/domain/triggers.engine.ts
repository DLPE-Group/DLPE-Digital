import type { Prisma } from '@prisma/client';
import type { CardDTO as Card } from '@dlpe/shared';
import { trackKeyToEnum } from './cards.service.js';
import { entityToCardDTO, type EntityRow } from './projection.js';
import { loadTenantResolver } from './tenancy.js';

export interface RunTriggersInput {
  whenTrack: string; // lowercase track key e.g. 'sales'
  whenStageName: string; // e.g. 'Contract signed'
  sourceCard: Card; // projected Card DTO of the source entity
  actor: { name: string; roleId: string };
}

export interface RunTriggersResult {
  createdCards: Card[];
  cascadeLines: { track: string; text: string }[];
}

// Deterministic ids for the seeded Brussels cascade so re-signing never duplicates.
const BRUSSELS_OPS_ID = 'o1';
const BRUSSELS_FIN_ID = 'f1';

interface TriggerCtx {
  // pipeline EntityType id by track key (operations → 'operation', finance → 'invoice')
  typeIdByTrack: Record<string, string>;
  tenantFor: (companyId: string | null) => string | null;
}

// Build the downstream Entity create payload for a trigger row + source card.
function buildEntityForTrigger(
  trigger: { thenTrack: string; thenStage: string; note: string },
  source: Card,
  ctx: TriggerCtx,
): { id: string; data: Prisma.EntityCreateInput } | null {
  const then = trigger.thenTrack;
  const tenantId = ctx.tenantFor(source.companyId ?? null);
  const companyConnect = source.companyId ? { connect: { id: source.companyId } } : undefined;

  // --- Brussels cascade (sales · Contract signed) ---
  if (then === 'operations' && trigger.thenStage === 'Vehicle ordered') {
    return {
      id: BRUSSELS_OPS_ID,
      data: {
        id: BRUSSELS_OPS_ID,
        tenantId,
        entityType: { connect: { id: ctx.typeIdByTrack.operations } },
        company: companyConnect,
        title: source.customer,
        value: null,
        owner: 'Tom Janssens',
        status: 'green',
        sub: 'Master order · auto-created on signature',
        sources: ['API', 'Talend'],
        fields: { type: 'DELIVERY', vehicle: 'Fleet · 78 vehicles', meta: null },
        trackId: 'operations',
        stageId: 'ordered',
        stageName: 'Vehicle ordered',
        days: 0,
        daysLabel: 'day 0 of 90',
        cta: 'Confirm with supplier',
        awaitingSign: false,
      },
    };
  }
  if (then === 'finance' && trigger.thenStage === 'Invoice to create') {
    return {
      id: BRUSSELS_FIN_ID,
      data: {
        id: BRUSSELS_FIN_ID,
        tenantId,
        entityType: { connect: { id: ctx.typeIdByTrack.finance } },
        company: companyConnect,
        title: source.customer,
        value: source.value ?? 2460000,
        owner: 'Ines Vandeput',
        status: 'amber',
        sub: 'Master invoice · first delivery',
        sources: ['API'],
        fields: { type: 'INVOICE', vehicle: null, meta: null },
        trackId: 'finance',
        stageId: 'to_make',
        stageName: 'Invoice to create',
        days: 0,
        daysLabel: 'day 0',
        cta: 'Generate invoice',
        awaitingSign: false,
      },
    };
  }

  // --- Workshop → Finance (approve PEPPOL supplier invoice) ---
  if (then === 'finance' && trigger.thenStage === 'Supplier invoice received') {
    return {
      id: `f-${source.id}-supplier`,
      data: {
        id: `f-${source.id}-supplier`,
        tenantId,
        entityType: { connect: { id: ctx.typeIdByTrack.finance } },
        company: companyConnect,
        title: source.customer,
        value: source.value ?? null,
        owner: 'Ines Vandeput',
        status: 'green',
        sub: 'Approved supplier invoice · routed from workshop',
        sources: ['PEPPOL'],
        fields: { type: 'SUPPLIER', vehicle: source.vehicle ?? null, meta: null },
        trackId: 'finance',
        stageId: 'supplier',
        stageName: 'Supplier invoice received',
        days: 0,
        daysLabel: 'received now',
        cta: 'Approve for payment',
        awaitingSign: false,
      },
    };
  }

  return null;
}

// Config-driven: reads CrossTrigger rows and creates downstream entities.
export async function runTriggers(
  tx: Prisma.TransactionClient,
  input: RunTriggersInput,
): Promise<RunTriggersResult> {
  const triggers = await tx.crossTrigger.findMany({
    where: { whenTrack: input.whenTrack, whenStage: input.whenStageName },
  });

  // Resolve the pipeline EntityType ids the cascades create into.
  const types = await tx.entityType.findMany({ where: { key: { in: ['operation', 'invoice'] } } });
  const typeIdByTrack: Record<string, string> = {};
  for (const t of types) {
    if (t.key === 'operation') typeIdByTrack.operations = t.id;
    if (t.key === 'invoice') typeIdByTrack.finance = t.id;
  }
  const tenantFor = await loadTenantResolver(tx as unknown as Parameters<typeof loadTenantResolver>[0]);
  const ctx: TriggerCtx = { typeIdByTrack, tenantFor };

  const createdCards: Card[] = [];
  const cascadeLines: { track: string; text: string }[] = [];

  for (const trigger of triggers) {
    const spec = buildEntityForTrigger(trigger, input.sourceCard, ctx);
    if (!spec) continue;

    // Guard: do not duplicate a deterministic entity if it already exists.
    const existing = await tx.entity.findUnique({ where: { id: spec.id } });
    const row = existing ?? (await tx.entity.create({ data: spec.data }));
    const card = entityToCardDTO(row as unknown as EntityRow) as unknown as Card;
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
