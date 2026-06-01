import type { PrismaClient } from '@prisma/client';

// Resolve the tenant (top-level GROUP node id) for a given company by walking
// the OrgNode parent chain. Falls back to the sole GROUP node when companyId is
// null/unknown. Pure over a preloaded node map for O(depth) lookups in backfill.
export interface OrgNodeLite { id: string; kind: string; parentId: string | null }

export function buildTenantResolver(nodes: OrgNodeLite[]): (companyId: string | null) => string | null {
  const byId = new Map<string, OrgNodeLite>();
  for (const n of nodes) byId.set(n.id, n);
  const soleGroup = nodes.find((n) => n.kind === 'GROUP')?.id ?? null;

  return (companyId: string | null): string | null => {
    let cur = companyId ? byId.get(companyId) : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      if (cur.kind === 'GROUP') return cur.id;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return soleGroup;
  };
}

export async function loadTenantResolver(prisma: PrismaClient) {
  const nodes = await prisma.orgNode.findMany({ select: { id: true, kind: true, parentId: true } });
  return buildTenantResolver(nodes);
}
