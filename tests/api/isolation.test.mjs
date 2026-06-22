import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, patch, del, token, TEST_DB_URL } from '../helpers.mjs';
import { ensureTenantB, destroyTenantB, TENANT_B_TOKEN } from '../iso-helper.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const A = () => token('u-robert', 'r.mertens@group.eu', 'group-admin'); // demo admin (tenant A)

beforeAll(async () => { await ensureTenantB(prisma); });
afterAll(async () => { await destroyTenantB(prisma); await prisma.$disconnect(); });

describe('isolation: users + roles list', () => {
  it('tenant A sees its own users; tenant B sees only its own', async () => {
    const a = await get('/admin/users', A());
    expect(a.status).toBe(200);
    expect(a.body.length).toBeGreaterThan(1); // demo has 9
    const b = await get('/admin/users', TENANT_B_TOKEN());
    expect(b.status).toBe(200);
    // tenant B sees ONLY its own user(s) — never the demo's users
    expect(b.body.every((u) => u.tenantId === 'tenant-iso-b')).toBe(true);
    expect(b.body.some((u) => u.email === 'r.mertens@group.eu')).toBe(false);
  });
  it('tenant B sees only its own roles', async () => {
    const b = await get('/admin/roles', TENANT_B_TOKEN());
    expect(b.status).toBe(200);
    expect(b.body.every((r) => r.tenantId === 'tenant-iso-b')).toBe(true);
    expect(b.body.some((r) => r.id === 'group-admin')).toBe(false);
  });
});

describe('isolation: RBAC writes', () => {
  it('tenant B cannot modify a tenant A user via PATCH', async () => {
    // PATCH as tenant B targeting demo user u-robert
    const patchRes = await patch('/admin/users/u-robert', { name: 'HACKED' }, TENANT_B_TOKEN());
    // RLS will either 404 (record not visible) or reject the write; both are acceptable
    const notModified = patchRes.status === 404 || patchRes.status === 400 || patchRes.status === 500;

    // Re-read u-robert as tenant A and confirm name is unchanged
    const getRes = await get('/admin/users/u-robert', A());
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).not.toBe('HACKED');
    // Also assert the PATCH did not succeed from B's perspective
    expect(notModified).toBe(true);
  });

  it('tenant B cannot delete a tenant A role via DELETE', async () => {
    // Attempt to delete demo role 'sales-mgr' (non-system, exists in tenant A)
    const deleteRes = await del('/admin/roles/sales-mgr', TENANT_B_TOKEN());
    // RLS will return 404 (role invisible to B) or block
    expect([400, 404, 500]).toContain(deleteRes.status);

    // Verify the role still exists from tenant A's view
    const rolesRes = await get('/admin/roles', A());
    expect(rolesRes.status).toBe(200);
    expect(rolesRes.body.some((r) => r.id === 'sales-mgr')).toBe(true);
  });

  it('tenant B GET /admin/field-rules returns only its own rows (none)', async () => {
    const r = await get('/admin/field-rules', TENANT_B_TOKEN());
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    // Tenant B has no field rules — must see empty array, never demo rows
    expect(r.body.length).toBe(0);
    expect(r.body.every((fr) => fr.tenantId === 'tenant-iso-b')).toBe(true);
  });

  it('tenant B GET /admin/rbac/versions returns only its own rows (none)', async () => {
    const r = await get('/admin/rbac/versions', TENANT_B_TOKEN());
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    // Tenant B has no rbac versions — must see empty array, never demo rows
    expect(r.body.length).toBe(0);
    expect(r.body.every((v) => v.tenantId === 'tenant-iso-b')).toBe(true);
  });
});

// Demo track keys seeded for tenant A (dlpeDemoBlueprint)
const DEMO_TRACK_KEYS = ['sales', 'operations', 'workshop', 'finance'];
// Demo org node IDs seeded for tenant A
const DEMO_NODE_IDS = ['grp', 'reg-benelux', 'co-nl', 'cmp-rotterdam'];

describe('isolation: config family', () => {
  it('GET /admin/data-model as tenant B returns only B tracks/types (none of demo)', async () => {
    const r = await get('/admin/data-model', TENANT_B_TOKEN());
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('tracks');
    expect(r.body).toHaveProperty('types');
    // Tenant B has no tracks/types — none of the demo track keys must appear
    const bTrackKeys = r.body.tracks.map((t) => t.key);
    const bTypeKeys = r.body.types.map((t) => t.key);
    for (const k of DEMO_TRACK_KEYS) {
      expect(bTrackKeys).not.toContain(k);
    }
    // Known demo type keys (pipeline types per track)
    for (const k of ['contract', 'operation', 'workshop_order', 'invoice', 'vehicle', 'fleet_operator']) {
      expect(bTypeKeys).not.toContain(k);
    }
  });

  it('GET /admin/structure as tenant B returns only B org nodes (none of demo)', async () => {
    const r = await get('/admin/structure', TENANT_B_TOKEN());
    // Tenant B has no org structure — 404 is acceptable, or a tree that excludes demo nodes
    if (r.status === 404) return; // fine — no nodes for B
    expect(r.status).toBe(200);
    // Flatten all node ids from the returned tree recursively
    function collectIds(node) {
      const ids = [node.id];
      for (const c of node.children || []) ids.push(...collectIds(c));
      return ids;
    }
    const bNodeIds = collectIds(r.body);
    for (const id of DEMO_NODE_IDS) {
      expect(bNodeIds).not.toContain(id);
    }
  });

  it('DELETE /admin/data-model/tracks/:key as tenant B does not affect tenant A track', async () => {
    // Try to delete demo track 'sales' as tenant B — RLS blocks it (track invisible to B)
    const delRes = await del('/admin/data-model/tracks/sales', TENANT_B_TOKEN());
    // Must be 404 (invisible) or 400 (blocked); never 200
    expect([400, 404, 500]).toContain(delRes.status);

    // Verify tenant A's 'sales' track still exists
    const dmA = await get('/admin/data-model', A());
    expect(dmA.status).toBe(200);
    expect(dmA.body.tracks.some((t) => t.key === 'sales')).toBe(true);
  });

  it('PATCH /admin/structure/:id as tenant B does not affect tenant A node', async () => {
    // Try to rename demo node 'grp' as tenant B — RLS blocks it (node invisible to B)
    const patchRes = await patch('/admin/structure/grp', { name: 'HACKED GROUP' }, TENANT_B_TOKEN());
    // Must be 404 (invisible) or 400/500 (blocked); never 200
    expect([400, 404, 500]).toContain(patchRes.status);

    // Verify tenant A's group root node name is unchanged
    const strA = await get('/admin/structure', A());
    expect(strA.status).toBe(200);
    function findNode(node, id) {
      if (node.id === id) return node;
      for (const c of node.children || []) { const f = findNode(c, id); if (f) return f; }
      return null;
    }
    const grp = findNode(strA.body, 'grp');
    expect(grp).not.toBeNull();
    expect(grp.name).not.toBe('HACKED GROUP');
  });
});
