import type { PrismaClient } from '@prisma/client';
import { TRACK_KEYS, STAGE_CONFIG, DATA_TYPES, FIELD_CATEGORIES } from '@dlpe/shared';
import { loadTenantResolver } from './tenancy.js';

const TRACK_META: Record<string, { label: string; color: string; order: number }> = {
  sales: { label: 'Sales', color: 'var(--track-sales)', order: 0 },
  operations: { label: 'Operations', color: 'var(--track-ops)', order: 1 },
  workshop: { label: 'Workshop', color: 'var(--track-workshop)', order: 2 },
  finance: { label: 'Finance', color: 'var(--track-finance)', order: 3 },
};

// One pipeline EntityType per track; key reused for RBAC/data-type alignment.
const PIPELINE_TYPE: Record<string, { key: string; label: string }> = {
  sales: { key: 'contract', label: 'Contract' },
  operations: { key: 'operation', label: 'Operation' },
  workshop: { key: 'workshop_order', label: 'Workshop order' },
  finance: { key: 'invoice', label: 'Invoice' },
};

const REFERENCE_TYPES = [
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'fleet_operator', label: 'Fleet operator' },
];

const dataKindFor = (cat: string | undefined): string =>
  cat === 'Financial' ? 'money' : 'text';

// Idempotent: upserts every derived row by stable key/id, so it can run on every
// seed and on an already-migrated DB without duplicating.
export async function backfillEntities(prisma: PrismaClient): Promise<void> {
  // 1) Tracks
  const trackIdByKey: Record<string, string> = {};
  for (const key of TRACK_KEYS) {
    const meta = TRACK_META[key];
    const row = await prisma.trackDef.upsert({
      where: { key },
      update: { label: meta.label, color: meta.color, order: meta.order, builtin: true },
      create: { key, label: meta.label, color: meta.color, order: meta.order, builtin: true },
    });
    trackIdByKey[key] = row.id;
  }

  // 2) Stages (from STAGE_CONFIG, keyed by track key)
  for (const key of TRACK_KEYS) {
    const stages = STAGE_CONFIG[key] ?? [];
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      await prisma.stageDef.upsert({
        where: { trackId_stageId: { trackId: trackIdByKey[key], stageId: s.id } },
        update: { order: i, label: s.label, sla: s.sla, lock: s.lock ?? null, cta: s.cta },
        create: { trackId: trackIdByKey[key], order: i, stageId: s.id, label: s.label, sla: s.sla, lock: s.lock ?? null, cta: s.cta },
      });
    }
  }

  // 3) Entity types (pipeline per track + reference types) and their fields
  const typeIdByKey: Record<string, string> = {};
  const fieldsByTypeKey: Record<string, { id: string; label: string; cat: string }[]> = {};
  for (const dt of DATA_TYPES) fieldsByTypeKey[dt.id] = dt.fields;

  let order = 0;
  for (const key of TRACK_KEYS) {
    const t = PIPELINE_TYPE[key];
    const row = await prisma.entityType.upsert({
      where: { key: t.key },
      update: { label: t.label, kind: 'pipeline', trackId: trackIdByKey[key], order, builtin: true },
      create: { key: t.key, label: t.label, kind: 'pipeline', trackId: trackIdByKey[key], order, builtin: true },
    });
    typeIdByKey[t.key] = row.id;
    order++;
  }
  for (const rt of REFERENCE_TYPES) {
    const row = await prisma.entityType.upsert({
      where: { key: rt.key },
      update: { label: rt.label, kind: 'reference', trackId: null, order, builtin: true },
      create: { key: rt.key, label: rt.label, kind: 'reference', trackId: null, order, builtin: true },
    });
    typeIdByKey[rt.key] = row.id;
    order++;
  }
  // FieldDefs for any type that has a matching DATA_TYPES entry
  for (const [typeKey, defs] of Object.entries(fieldsByTypeKey)) {
    const entityTypeId = typeIdByKey[typeKey];
    if (!entityTypeId) continue;
    for (let i = 0; i < defs.length; i++) {
      const fd = defs[i];
      await prisma.fieldDef.upsert({
        where: { entityTypeId_key: { entityTypeId, key: fd.id } },
        update: { label: fd.label, category: fd.cat, dataKind: dataKindFor(fd.cat), order: i, builtin: true },
        create: { entityTypeId, key: fd.id, label: fd.label, category: fd.cat, dataKind: dataKindFor(fd.cat), order: i, builtin: true },
      });
    }
  }
  void FIELD_CATEGORIES; // categories are sourced from DATA_TYPES.fields[].cat

  // 4) Entities from Cards
  const tenantFor = await loadTenantResolver(prisma);
  const cards = await prisma.card.findMany();
  for (const c of cards) {
    const trackKey = c.track.toLowerCase();
    const typeKey = PIPELINE_TYPE[trackKey]?.key;
    if (!typeKey) continue;
    await prisma.entity.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        tenantId: tenantFor(c.companyId),
        entityTypeId: typeIdByKey[typeKey],
        companyId: c.companyId,
        title: c.customer,
        value: c.value,
        owner: c.owner,
        status: c.status,
        sub: c.sub,
        sources: c.sources,
        fields: { type: c.type, vehicle: c.vehicle, meta: c.meta },
        trackId: trackKey,
        stageId: c.stageId,
        stageName: c.stageName,
        days: c.days,
        daysLabel: c.daysLabel,
        cta: c.cta,
        awaitingSign: c.awaitingSign,
        createdById: c.createdById,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      },
    });
  }

  // 5) Entities from Vehicles (reference)
  const vehicles = await prisma.vehicle.findMany();
  for (const v of vehicles) {
    await prisma.entity.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        tenantId: tenantFor(v.companyId),
        entityTypeId: typeIdByKey['vehicle'],
        companyId: v.companyId,
        title: v.plate,
        status: v.status,
        sources: [],
        fields: { plate: v.plate, model: v.model, vin: v.vin, operator: v.operator, statusLabel: v.statusLabel, note: v.note, meta: v.meta },
      },
    });
  }
}
