import type { PrismaClient } from '@prisma/client';

// Single demo-tenant id — used as the sole tenantId until multi-tenant provisioning lands.
export const DEMO_TENANT_ID = 'tenant-dlpe-demo';

// Resolve the Tenant.id for a given company by walking the OrgNode parent chain
// to find the GROUP node, then looking up the Tenant whose OrgNode GROUP matches.
// Returns null for nodes with no resolvable GROUP; callers fall back to `?? DEMO_TENANT_ID`
// until multi-tenant provisioning (S1) replaces this. Pure over preloaded maps
// for O(depth) lookups in bulk seed/backfill.
export interface OrgNodeLite { id: string; kind: string; parentId: string | null; tenantId: string | null }

export function buildTenantResolver(
  nodes: OrgNodeLite[],
): (companyId: string | null) => string | null {
  const byId = new Map<string, OrgNodeLite>();
  for (const n of nodes) byId.set(n.id, n);

  // Find the Tenant.id attached to the sole GROUP node (if any).
  const groupNode = nodes.find((n) => n.kind === 'GROUP');
  const soleTenantId = groupNode?.tenantId ?? null;

  return (companyId: string | null): string | null => {
    // Walk up the OrgNode tree to the GROUP node, then return its tenantId.
    let cur = companyId ? byId.get(companyId) : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      if (cur.kind === 'GROUP') return cur.tenantId ?? null;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return soleTenantId;
  };
}

export async function loadTenantResolver(prisma: PrismaClient) {
  const nodes = await prisma.orgNode.findMany({
    select: { id: true, kind: true, parentId: true, tenantId: true },
  });
  return buildTenantResolver(nodes);
}
