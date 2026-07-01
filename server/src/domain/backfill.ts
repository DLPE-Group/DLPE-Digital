import type { Prisma } from '@prisma/client';
import { TRACK_KEY_FROM_ENUM } from '@dlpe/shared';

// One pipeline EntityType per BUILTIN track; key reused for RBAC/data-type
// alignment. Used as a fallback when a seed row doesn't name its own type.
const PIPELINE_TYPE: Record<string, { key: string; label: string }> = {
  sales: { key: 'contract', label: 'Contract' },
  operations: { key: 'operation', label: 'Operation' },
  workshop: { key: 'workshop_order', label: 'Workshop order' },
  finance: { key: 'invoice', label: 'Invoice' },
};

export interface MetaCtx {
  trackIdByKey: Record<string, string>;
  typeIdByKey: Record<string, string>;
  tenantFor: (companyId: string | null) => string;
  tenantId: string;
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
// Uses EntityUncheckedCreateInput so that tenantId can be passed as a raw scalar
// (the checked type requires `tenant: { connect: ... }` once the relation exists).
export function cardToEntityCreate(c: CardSeed, ctx: MetaCtx): Prisma.EntityUncheckedCreateInput {
  const trackKey = TRACK_KEY_FROM_ENUM[c.track] ?? c.track.toLowerCase();
  // Prefer the seed row's OWN pipeline type when it names a real one (so custom
  // tracks seed onto their own type); else the builtin track→type map; else
  // 'operation'. NB: demo seed rows carry display types ('RENEWAL', 'SERVICE')
  // that aren't type keys, so they correctly fall through to the track map.
  const typeKey =
    (typeof c.type === 'string' && ctx.typeIdByKey[c.type]) ? c.type
    : (PIPELINE_TYPE[trackKey]?.key ?? 'operation');
  return {
    id: c.id,
    tenantId: ctx.tenantFor(c.companyId ?? null),
    entityTypeId: ctx.typeIdByKey[typeKey],
    companyId: c.companyId ?? null,
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
// Uses EntityUncheckedCreateInput so that tenantId can be passed as a raw scalar.
export function vehicleToEntityCreate(v: VehicleSeed, ctx: MetaCtx): Prisma.EntityUncheckedCreateInput {
  return {
    id: v.id ?? `veh-${v.plate.replace(/[^A-Za-z0-9]/g, '')}`,
    tenantId: ctx.tenantFor(v.companyId ?? null),
    entityTypeId: ctx.typeIdByKey['vehicle'],
    companyId: v.companyId ?? null,
    title: v.plate,
    status: v.status ?? null,
    sources: [],
    fields: {
      plate: v.plate, model: v.model ?? null, vin: v.vin ?? null, operator: v.operator ?? null,
      statusLabel: v.statusLabel ?? null, note: v.note ?? null,
    },
  };
}
