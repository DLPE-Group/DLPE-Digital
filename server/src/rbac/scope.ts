import { prisma } from '../prisma.js';
import type { Prisma } from '@prisma/client';

// Row-level scope: the set of company-node ids a user may see, or `null` = ALL
// (no row filtering — group scope, or a misconfigured multi_company with no
// scope nodes, which we treat leniently as all rather than show nothing).
// Pass `db` (from withTenant) when called from a request context so RLS is enforced.
export async function visibleCompanyIds(userId: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<Set<string> | null> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { secondary: true } });
  if (!user || user.scopeType === 'group') return null;

  const nodes = await db.orgNode.findMany();
  const childrenOf: Record<string, string[]> = {};
  const kindOf: Record<string, string> = {};
  for (const n of nodes) {
    kindOf[n.id] = n.kind;
    if (n.parentId) (childrenOf[n.parentId] ??= []).push(n.id);
  }
  const companiesUnder = (rootId: string): string[] => {
    const out: string[] = [];
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop() as string;
      if (kindOf[id] === 'COMPANY') out.push(id);
      (childrenOf[id] || []).forEach((c) => stack.push(c));
    }
    return out;
  };

  const scopeNodes = [user.scopeNodeId, ...user.secondary.map((s) => s.scopeNodeId)]
    .filter((x): x is string => !!x);
  if (scopeNodes.length === 0) return null; // lenient: nothing to scope by → show all

  const set = new Set<string>();
  for (const nodeId of scopeNodes) companiesUnder(nodeId).forEach((c) => set.add(c));
  return set;
}
