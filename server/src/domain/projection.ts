// Minimal shapes the projection needs (a subset of the Prisma Entity row).
export interface EntityRow {
  id: string;
  companyId: string | null;
  trackId?: string | null;
  title: string;
  value?: number | null;
  owner?: string | null;
  status?: string | null;
  sub?: string | null;
  sources?: string[];
  stageId?: string | null;
  stageName?: string | null;
  days?: number;
  daysLabel?: string | null;
  cta?: string | null;
  awaitingSign?: boolean;
  fields?: Record<string, unknown> | null;
  createdById?: string | null;
}

// Project a pipeline entity back to the Card DTO. `track` is the bare
// operational track key (e.g. 'sales', or a custom 'insurance') — the same key
// used by Entity.trackId, /cards, /stages, and allowedTracks. (It used to be
// projected through the fixed `Track` enum, which dropped custom tracks.)
export function entityToCardDTO(e: EntityRow) {
  const f = (e.fields ?? {}) as Record<string, unknown>;
  return {
    id: e.id,
    companyId: e.companyId,
    track: e.trackId ?? null,
    type: (f.type as string) ?? null,
    customer: e.title,
    value: e.value ?? null,
    vehicle: (f.vehicle as string | null) ?? null,
    sub: e.sub ?? '',
    stageId: e.stageId ?? '',
    stageName: e.stageName ?? '',
    days: e.days ?? 0,
    daysLabel: e.daysLabel ?? null,
    owner: e.owner ?? '',
    status: e.status ?? '',
    cta: e.cta ?? '',
    sources: e.sources ?? [],
    awaitingSign: e.awaitingSign ?? false,
    meta: (f.meta as unknown) ?? null,
    createdById: e.createdById ?? null,
  };
}

// Project a reference (vehicle) entity back to the legacy Vehicle DTO.
export function entityToVehicleDTO(e: EntityRow) {
  const f = (e.fields ?? {}) as Record<string, unknown>;
  return {
    id: e.id,
    plate: (f.plate as string) ?? e.title,
    model: (f.model as string | null) ?? null,
    vin: (f.vin as string | null) ?? null,
    operator: (f.operator as string | null) ?? null,
    status: e.status ?? null,
    statusLabel: (f.statusLabel as string | null) ?? null,
    note: (f.note as string | null) ?? null,
    companyId: e.companyId,
  };
}
