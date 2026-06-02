import type { Prisma, PrismaClient } from '@prisma/client';
import { TRACK_KEYS, STAGE_CONFIG, DATA_TYPES, TRACK_KEY_FROM_ENUM } from '@dlpe/shared';
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

const dataKindFor = (cat: string | undefined): string => (cat === 'Financial' ? 'money' : 'text');

export interface MetaCtx {
  trackIdByKey: Record<string, string>;
  typeIdByKey: Record<string, string>;
  tenantFor: (companyId: string | null) => string | null;
}

// Create/refresh the data-driven meta-model (tracks, stages, entity types,
// fields) from the shared catalogues. Idempotent. Returns lookups + the tenant
// resolver so callers can build Entity rows.
export async function seedMetaModel(prisma: PrismaClient): Promise<MetaCtx> {
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

  const typeIdByKey: Record<string, string> = {};
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
  const fieldsByTypeKey: Record<string, { id: string; label: string; cat: string }[]> = {};
  for (const dt of DATA_TYPES) fieldsByTypeKey[dt.id] = dt.fields;
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

  const tenantFor = await loadTenantResolver(prisma);
  return { trackIdByKey, typeIdByKey, tenantFor };
}

// A legacy card-shaped seed row (track may be the enum 'SALES' or key 'sales').
export interface CardSeed {
  id: string;
  companyId?: string | null;
  track: string;
  type: string;
  customer: string;
  value?: number | null;
  vehicle?: string | null;
  sub: string;
  stageId: string;
  stageName: string;
  days: number;
  daysLabel?: string | null;
  owner: string;
  status: string;
  cta: string;
  sources: string[];
  awaitingSign?: boolean;
  meta?: unknown;
}

// Map a card-shaped seed row to an Entity create payload (pipeline kind).
export function cardToEntityCreate(c: CardSeed, ctx: MetaCtx): Prisma.EntityCreateInput {
  const trackKey = TRACK_KEY_FROM_ENUM[c.track] ?? c.track.toLowerCase();
  const typeKey = PIPELINE_TYPE[trackKey]?.key ?? 'operation';
  return {
    id: c.id,
    tenantId: ctx.tenantFor(c.companyId ?? null),
    entityType: { connect: { id: ctx.typeIdByKey[typeKey] } },
    company: c.companyId ? { connect: { id: c.companyId } } : undefined,
    title: c.customer,
    value: c.value ?? null,
    owner: c.owner,
    status: c.status,
    sub: c.sub,
    sources: c.sources,
    fields: { type: c.type, vehicle: c.vehicle ?? null, meta: (c.meta as Prisma.InputJsonValue) ?? null },
    trackId: trackKey,
    stageId: c.stageId,
    stageName: c.stageName,
    days: c.days,
    daysLabel: c.daysLabel ?? null,
    cta: c.cta,
    awaitingSign: c.awaitingSign ?? false,
  };
}

export interface VehicleSeed {
  id?: string;
  plate: string;
  model?: string | null;
  vin?: string | null;
  operator?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  note?: string | null;
  companyId?: string | null;
}

// Map a vehicle-shaped seed row to an Entity create payload (reference kind).
export function vehicleToEntityCreate(v: VehicleSeed, ctx: MetaCtx): Prisma.EntityCreateInput {
  return {
    id: v.id ?? `veh-${v.plate.replace(/[^A-Za-z0-9]/g, '')}`,
    tenantId: ctx.tenantFor(v.companyId ?? null),
    entityType: { connect: { id: ctx.typeIdByKey['vehicle'] } },
    company: v.companyId ? { connect: { id: v.companyId } } : undefined,
    title: v.plate,
    status: v.status ?? null,
    sources: [],
    fields: {
      plate: v.plate, model: v.model ?? null, vin: v.vin ?? null, operator: v.operator ?? null,
      statusLabel: v.statusLabel ?? null, note: v.note ?? null,
    },
  };
}
