import type { Prisma } from '@prisma/client';
import type { CardDTO as Card } from '@dlpe/shared';
import { entityToCardDTO, type EntityRow } from './projection.js';
import { operationalKey, tenantSlugPrefix } from './trackKeys.js';

export interface RunTriggersInput {
  whenTrack: string; // operational track key of the source card, e.g. 'sales'
  whenStageName: string; // the stage label the source card just entered, e.g. 'Contract'
  sourceCard: Card; // projected Card DTO of the source entity
  actor: { name: string; roleId: string };
}

export interface RunTriggersResult {
  createdCards: Card[];
  cascadeLines: { track: string; text: string }[];
}

// Config-driven cross-track cascade: for every CrossTrigger whose (whenTrack,
// whenStage) matches the source card's track + the stage it just entered, create
// a card in `thenTrack` at the stage whose label is `thenStage`. Fully generic —
// works for builtin AND custom tracks, and for triggers authored in the editor.
// The downstream card id is deterministic per (trigger, source) so the same
// transition can't spawn duplicates if replayed.
export async function runTriggers(
  tx: Prisma.TransactionClient,
  input: RunTriggersInput,
  tenantId: string,
): Promise<RunTriggersResult> {
  const triggers = await tx.crossTrigger.findMany({
    where: { whenTrack: input.whenTrack, whenStage: input.whenStageName },
  });
  if (triggers.length === 0) return { createdCards: [], cascadeLines: [] };

  const pfx = await tenantSlugPrefix(tenantId, tx);
  // All pipeline types, so we can resolve each trigger's thenTrack → its type
  // via the TrackDef relation (operational key), like createCard does.
  const pipelineTypes = await tx.entityType.findMany({ where: { kind: 'pipeline' }, include: { track: true } });
  const typeForTrack = (trackKey: string) =>
    pipelineTypes.find((t) => t.track && operationalKey(t.track.key, t.track.builtin, pfx) === trackKey);

  const source = input.sourceCard;
  const createdCards: Card[] = [];
  const cascadeLines: { track: string; text: string }[] = [];

  for (const trig of triggers) {
    const type = typeForTrack(trig.thenTrack);
    if (!type) continue; // thenTrack has no pipeline type — nothing to create into

    // Resolve the target stage by label from the tenant's saved config; fall
    // back to the first stage, then to a slug of the label.
    const stageRows = await tx.stageConfig.findMany({ where: { track: trig.thenTrack }, orderBy: { order: 'asc' } });
    const stage = stageRows.find((s) => s.label === trig.thenStage) ?? stageRows[0];
    const stageId = stage?.stageId ?? trig.thenStage.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const stageName = stage?.label ?? trig.thenStage;

    const id = `trig-${trig.id}-${source.id}`;
    const existing = await tx.entity.findUnique({ where: { id } });
    const row =
      existing ??
      (await tx.entity.create({
        data: {
          id,
          tenantId,
          entityTypeId: type.id,
          companyId: source.companyId ?? null,
          title: source.customer,
          value: source.value ?? null,
          owner: source.owner || input.actor.name,
          status: 'green',
          sub: trig.note || `Auto-created from ${input.whenTrack} · ${input.whenStageName}`,
          sources: [],
          fields: { type: type.key, vehicle: source.vehicle ?? null, meta: null },
          trackId: trig.thenTrack,
          stageId,
          stageName,
          days: 0,
          daysLabel: 'created now',
          cta: stage?.cta ?? '',
          awaitingSign: false,
        },
      }));
    const card = entityToCardDTO(row as unknown as EntityRow) as unknown as Card;
    createdCards.push(card);
    cascadeLines.push({
      track: trig.thenTrack,
      text: `Created card · "${card.stageName}${card.value ? ' · €' + card.value.toLocaleString() : ''}"`,
    });
  }

  return { createdCards, cascadeLines };
}
