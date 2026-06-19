import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../prisma.js';

export interface EntitlementState {
  planKey: string | null;
  status: string | null;
  features: string[];
  limits: Record<string, number>;
}

const BILLABLE_ACTIVE_STATUSES = new Set(['TRIALING', 'ACTIVE']);

function parseEntitlements(entitlements: unknown): { features: string[]; limits: Record<string, number> } {
  if (!entitlements || typeof entitlements !== 'object' || Array.isArray(entitlements)) {
    return { features: [], limits: {} };
  }
  const raw = entitlements as Record<string, unknown>;

  const features: string[] = Array.isArray(raw.features)
    ? raw.features.filter((f): f is string => typeof f === 'string')
    : [];

  const limits: Record<string, number> = {};
  if (raw.limits && typeof raw.limits === 'object' && !Array.isArray(raw.limits)) {
    for (const [k, v] of Object.entries(raw.limits as Record<string, unknown>)) {
      if (typeof v === 'number') limits[k] = v;
    }
  }

  return { features, limits };
}

export async function loadEntitlements(
  tenantId: string,
  db: PrismaClient = defaultPrisma,
): Promise<EntitlementState> {
  const sub = await db.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });

  if (!sub) {
    return { planKey: null, status: null, features: [], limits: {} };
  }

  const { features, limits } = parseEntitlements(sub.plan.entitlements);

  return {
    planKey: sub.plan.key,
    status: sub.status,
    features,
    limits,
  };
}

export async function tenantHasFeature(
  tenantId: string,
  feature: string,
  db?: PrismaClient,
): Promise<boolean> {
  const ent = await loadEntitlements(tenantId, db);
  return ent.features.includes(feature);
}

export async function tenantWithinLimit(
  tenantId: string,
  limitKey: string,
  currentCount: number,
  db?: PrismaClient,
): Promise<boolean> {
  const ent = await loadEntitlements(tenantId, db);
  const limit = ent.limits[limitKey];
  if (limit === undefined) return true; // no limit set → always within
  return currentCount < limit;
}

export async function isBillableActive(
  tenantId: string,
  db?: PrismaClient,
): Promise<boolean> {
  const ent = await loadEntitlements(tenantId, db);
  return ent.status !== null && BILLABLE_ACTIVE_STATUSES.has(ent.status);
}
