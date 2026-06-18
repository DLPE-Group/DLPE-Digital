import { prisma } from '../prisma.js';
import type { OrgNode } from '@prisma/client';

export interface TreeNode extends OrgNode {
  children: TreeNode[];
}

// Build the nested tree (group → region/country → company) from flat rows.
export async function getTree(): Promise<TreeNode | null> {
  const nodes = await prisma.orgNode.findMany();
  const byId = new Map<string, TreeNode>();
  nodes.forEach((n) => byId.set(n.id, { ...n, children: [] }));
  let root: TreeNode | null = null;
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else if (!node.parentId) {
      root = node;
    }
  });
  return root;
}

// Walk root→node, returning the ancestor chain (used by resolveSetting).
function findPath(node: TreeNode, id: string, trail: TreeNode[] = []): TreeNode[] | null {
  const here = [...trail, node];
  if (node.id === id) return here;
  for (const c of node.children) {
    const r = findPath(c, id, here);
    if (r) return r;
  }
  return null;
}

export interface ResolvedSetting {
  value: unknown;
  inherited: boolean;
  overridden: boolean;
  sourceName: string | null;
}

// resolveSetting — ported from app/src/admin_structure.jsx.
export function resolveSetting(path: TreeNode[], key: string): ResolvedSetting {
  const self = path[path.length - 1];
  const settings = (self.settings as Record<string, unknown> | null) || {};
  const overrides = (self.overrides as Record<string, unknown> | null) || {};
  const ownExplicit = key in settings || key in overrides;
  const ownVal = overrides[key] ?? settings[key];

  let inheritedFrom: TreeNode | null = null;
  let inheritedVal: unknown;
  for (let i = path.length - 2; i >= 0; i--) {
    const n = path[i];
    const ns = (n.settings as Record<string, unknown> | null) || {};
    const no = (n.overrides as Record<string, unknown> | null) || {};
    const v = ns[key] ?? no[key];
    if (v != null) {
      inheritedFrom = n;
      inheritedVal = v;
      break;
    }
  }

  if (ownExplicit && ownVal != null) {
    return {
      value: ownVal,
      inherited: false,
      overridden: !!inheritedFrom,
      sourceName: inheritedFrom ? inheritedFrom.name : null,
    };
  }
  if (inheritedFrom) {
    return { value: inheritedVal, inherited: true, overridden: false, sourceName: inheritedFrom.name };
  }
  return { value: null, inherited: false, overridden: false, sourceName: null };
}

// Resolve all settings keys present anywhere in the node's path.
export async function resolveSettingsFor(id: string): Promise<Record<string, ResolvedSetting>> {
  const root = await getTree();
  if (!root) return {};
  const path = findPath(root, id);
  if (!path) return {};
  const keys = new Set<string>();
  path.forEach((n) => {
    Object.keys((n.settings as Record<string, unknown> | null) || {}).forEach((k) => keys.add(k));
    Object.keys((n.overrides as Record<string, unknown> | null) || {}).forEach((k) => keys.add(k));
  });
  const out: Record<string, ResolvedSetting> = {};
  keys.forEach((k) => (out[k] = resolveSetting(path, k)));
  return out;
}

// Add a company under a parent node.
export async function addCompany(
  parentId: string,
  data: { name: string; code?: string; meta?: unknown; overrides?: unknown },
  tenantId: string,
) {
  const id = 'cmp-' + (data.code || data.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return prisma.orgNode.create({
    data: {
      id,
      kind: 'COMPANY',
      name: data.name,
      code: data.code,
      meta: (data.meta as object) ?? undefined,
      overrides: (data.overrides as object) ?? undefined,
      parentId,
      tenantId,
    },
  });
}

const KIND_PREFIX: Record<string, string> = { REGION: 'reg-', COUNTRY: 'co-', COMPANY: 'cmp-' };

// Add a child node of any kind (region/country/company) under a parent.
export async function addNode(
  parentId: string,
  data: { kind: 'REGION' | 'COUNTRY' | 'COMPANY'; name: string; code?: string },
  tenantId: string,
) {
  const parent = await prisma.orgNode.findUnique({ where: { id: parentId } });
  if (!parent) throw new Error('Parent node not found');
  const base = (data.code || data.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = (KIND_PREFIX[data.kind] ?? 'node-') + base;
  return prisma.orgNode.create({
    data: { id, kind: data.kind, name: data.name, code: data.code, parentId, tenantId },
  });
}

// Delete a node — blocked if it has children, scoped users, or (for companies)
// any entities attached.
export async function deleteNode(id: string): Promise<void> {
  const node = await prisma.orgNode.findUnique({ where: { id } });
  if (!node) throw new Error('Node not found');
  if (node.kind === 'GROUP') throw new Error('The group root cannot be deleted.');
  const children = await prisma.orgNode.count({ where: { parentId: id } });
  if (children > 0) throw new Error(`Node has ${children} child node(s) — remove them first.`);
  const entities = await prisma.entity.count({ where: { companyId: id } });
  if (entities > 0) throw new Error(`Node has ${entities} item(s) attached — remove them first.`);
  const [usersP, scopes] = await Promise.all([
    prisma.user.count({ where: { scopeNodeId: id } }),
    prisma.userScope.count({ where: { scopeNodeId: id } }),
  ]);
  if (usersP + scopes > 0) throw new Error(`Node is in ${usersP + scopes} user scope(s) — reassign them first.`);
  await prisma.orgNode.delete({ where: { id } });
}

export async function updateNode(id: string, data: { name?: string; meta?: unknown; settings?: unknown; overrides?: unknown }) {
  return prisma.orgNode.update({
    where: { id },
    data: {
      name: data.name,
      meta: (data.meta as object) ?? undefined,
      settings: (data.settings as object) ?? undefined,
      overrides: (data.overrides as object) ?? undefined,
    },
  });
}
