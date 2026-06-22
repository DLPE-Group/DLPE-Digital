import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, patch, del, post, token, TEST_DB_URL } from '../helpers.mjs';
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

describe('isolation: integrations + triggers', () => {
  it('GET /api/integrations as tenant B returns only B rows (none of demo)', async () => {
    // Fetch demo (tenant A) integrations to capture known ids/names
    const aRes = await get('/integrations', A());
    expect(aRes.status).toBe(200);
    expect(aRes.body.length).toBeGreaterThan(0); // demo has integrations seeded

    const demoIds = aRes.body.map((i) => i.id);
    const demoNames = aRes.body.map((i) => i.name);

    // Tenant B sees only its own integrations (none seeded)
    const bRes = await get('/integrations', TENANT_B_TOKEN());
    expect(bRes.status).toBe(200);
    expect(Array.isArray(bRes.body)).toBe(true);
    // None of demo integration ids or names must appear
    expect(bRes.body.every((i) => !demoIds.includes(i.id))).toBe(true);
    expect(bRes.body.every((i) => !demoNames.includes(i.name))).toBe(true);
  });

  it('GET /api/admin/triggers as tenant B returns only B rows (none of demo)', async () => {
    // Fetch demo (tenant A) triggers
    const aRes = await get('/admin/triggers', A());
    expect(aRes.status).toBe(200);
    expect(aRes.body.length).toBeGreaterThan(0); // demo has triggers seeded

    const demoIds = aRes.body.map((t) => t.id);

    // Tenant B sees only its own triggers (none seeded)
    const bRes = await get('/admin/triggers', TENANT_B_TOKEN());
    expect(bRes.status).toBe(200);
    expect(Array.isArray(bRes.body)).toBe(true);
    // None of demo trigger ids must appear
    expect(bRes.body.every((t) => !demoIds.includes(t.id))).toBe(true);
  });

  it('DELETE /api/integrations/:id as tenant B does not delete a tenant A integration', async () => {
    // Get a demo integration id (tenant A)
    const aRes = await get('/integrations', A());
    expect(aRes.status).toBe(200);
    expect(aRes.body.length).toBeGreaterThan(0);
    const demoIntegrationId = aRes.body[0].id;

    // Attempt delete as tenant B — RLS makes the row invisible, so 404
    const delRes = await del(`/integrations/${demoIntegrationId}`, TENANT_B_TOKEN());
    expect([400, 404, 500]).toContain(delRes.status);

    // Re-read as tenant A — integration must still exist
    const aResAfter = await get('/integrations', A());
    expect(aResAfter.status).toBe(200);
    expect(aResAfter.body.some((i) => i.id === demoIntegrationId)).toBe(true);
  });

  it('PATCH /api/admin/triggers/:id as tenant B does not modify a tenant A trigger', async () => {
    // Get a demo trigger id (tenant A)
    const aRes = await get('/admin/triggers', A());
    expect(aRes.status).toBe(200);
    expect(aRes.body.length).toBeGreaterThan(0);
    const demoTrigger = aRes.body[0];

    // Attempt patch as tenant B — RLS makes the row invisible, expect non-200
    const patchRes = await patch(`/admin/triggers/${demoTrigger.id}`, { note: 'HACKED' }, TENANT_B_TOKEN());
    expect([400, 404, 500]).toContain(patchRes.status);

    // Re-read as tenant A — trigger note must be unchanged
    const aResAfter = await get('/admin/triggers', A());
    expect(aResAfter.status).toBe(200);
    const found = aResAfter.body.find((t) => t.id === demoTrigger.id);
    expect(found).toBeDefined();
    expect(found.note).not.toBe('HACKED');
  });
});

describe('isolation: reporting + me', () => {
  it('GET /reports as tenant B returns none of demo reports', async () => {
    // Confirm tenant A has reports
    const aRes = await get('/reports', A());
    expect(aRes.status).toBe(200);
    const demoIds = aRes.body.map((r) => r.id);

    // Tenant B has no reports seeded — must see empty array
    const bRes = await get('/reports', TENANT_B_TOKEN());
    expect(bRes.status).toBe(200);
    expect(Array.isArray(bRes.body)).toBe(true);
    // None of demo report ids must appear
    expect(bRes.body.every((r) => !demoIds.includes(r.id))).toBe(true);
  });

  it('GET /audit as tenant B returns none of demo audit entries', async () => {
    // Tenant A has audit entries; confirm
    const aRes = await get('/audit', A());
    expect(aRes.status).toBe(200);
    expect(aRes.body.length).toBeGreaterThan(0);
    const demoIds = aRes.body.map((e) => e.id);

    // Tenant B sees only its own audit entries (none seeded)
    const bRes = await get('/audit', TENANT_B_TOKEN());
    expect(bRes.status).toBe(200);
    expect(Array.isArray(bRes.body)).toBe(true);
    expect(bRes.body.every((e) => !demoIds.includes(e.id))).toBe(true);
  });

  it('DELETE /reports/:id as tenant B does not delete a tenant A report', async () => {
    // Get a demo report id (tenant A). Demo may have no reports seeded — skip if so.
    const aRes = await get('/reports', A());
    expect(aRes.status).toBe(200);
    if (aRes.body.length === 0) return; // no demo reports to test against

    const demoReportId = aRes.body[0].id;

    // Attempt delete as tenant B — RLS makes the row invisible → 404
    const delRes = await del(`/reports/${demoReportId}`, TENANT_B_TOKEN());
    expect([400, 404, 500]).toContain(delRes.status);

    // Re-read as tenant A — report must still exist
    const aResAfter = await get('/reports', A());
    expect(aResAfter.status).toBe(200);
    expect(aResAfter.body.some((r) => r.id === demoReportId)).toBe(true);
  });

  it('GET /me/permissions as tenant B resolves against B roles only (no 500)', async () => {
    const bRes = await get('/me/permissions', TENANT_B_TOKEN());
    // Must succeed
    expect(bRes.status).toBe(200);
    // roleIds must only contain B's own role(s)
    expect(Array.isArray(bRes.body.roleIds)).toBe(true);
    expect(bRes.body.roleIds.every((id) => !id.startsWith('group-admin') || id === 'iso-b-group-admin')).toBe(true);
    // Must not contain demo-specific field rules
    expect(bRes.body.roleIds.includes('group-admin')).toBe(false);
    expect(bRes.body.roleIds.includes('sales-mgr')).toBe(false);
  });
});

describe('isolation: domain/entity', () => {
  it('GET /vehicles as tenant B returns none of demo vehicles (B has none → empty)', async () => {
    // Confirm demo (tenant A) has vehicles
    const aRes = await get('/vehicles', A());
    expect(aRes.status).toBe(200);
    expect(aRes.body.length).toBeGreaterThan(0);

    const demoVehicleIds = aRes.body.map((v) => v.id);

    // Tenant B has no vehicles — must see empty array
    const bRes = await get('/vehicles', TENANT_B_TOKEN());
    expect(bRes.status).toBe(200);
    expect(Array.isArray(bRes.body)).toBe(true);
    expect(bRes.body.length).toBe(0);
    // None of demo vehicle ids must appear
    expect(bRes.body.every((v) => !demoVehicleIds.includes(v.id))).toBe(true);
  });

  it('GET /portal/messages as tenant B returns none of demo messages (B has none → empty)', async () => {
    // Seed a portal message as tenant A (seed doesn't include them, POST one directly)
    const { post: postHelper } = await import('../helpers.mjs');
    const postRes = await postHelper('/portal/messages', { body: 'isolation-test-msg', operator: 'Test Operator' }, A());
    expect(postRes.status).toBe(200);
    expect(postRes.body.id).toBeTruthy();
    const demoMsgId = postRes.body.id;

    try {
      // Confirm tenant A can read it
      const aRes = await get('/portal/messages', A());
      expect(aRes.status).toBe(200);
      expect(aRes.body.some((m) => m.id === demoMsgId)).toBe(true);

      // Tenant B has no messages — must see empty array, never A's messages
      const bRes = await get('/portal/messages', TENANT_B_TOKEN());
      expect(bRes.status).toBe(200);
      expect(Array.isArray(bRes.body)).toBe(true);
      expect(bRes.body.every((m) => m.id !== demoMsgId)).toBe(true);
    } finally {
      // Clean up: delete the test message directly via owner prisma
      await prisma.portalMessage.delete({ where: { id: demoMsgId } }).catch(() => {});
    }
  });

  it('GET /cards/:id as tenant B targeting a demo card id returns 404 (RLS hides it)', async () => {
    // Get a demo card id from tenant A (sales track)
    const aRes = await get('/cards?track=sales', A());
    expect(aRes.status).toBe(200);
    expect(aRes.body.length).toBeGreaterThan(0);
    const demoCardId = aRes.body[0].id;

    // Tenant B cannot see tenant A's card — must get 404
    const bRes = await get(`/cards/${demoCardId}`, TENANT_B_TOKEN());
    expect(bRes.status).toBe(404);
  });

  it('PATCH /cards/:id as tenant B targeting a demo card id does NOT modify it', async () => {
    // Get a demo card id from tenant A
    const aRes = await get('/cards?track=sales', A());
    expect(aRes.status).toBe(200);
    expect(aRes.body.length).toBeGreaterThan(0);
    const demoCard = aRes.body[0];
    const demoCardId = demoCard.id;
    const originalCustomer = demoCard.customer;

    // Attempt to patch as tenant B — RLS makes the row invisible → 404 or error
    const patchRes = await patch(`/cards/${demoCardId}`, { customer: 'HACKED' }, TENANT_B_TOKEN());
    expect([400, 404, 500]).toContain(patchRes.status);

    // Re-read as tenant A — card must be unchanged
    const aResAfter = await get(`/cards/${demoCardId}`, A());
    expect(aResAfter.status).toBe(200);
    expect(aResAfter.body.customer).toBe(originalCustomer);
    expect(aResAfter.body.customer).not.toBe('HACKED');
  });
});

describe('isolation: cards actions endpoint', () => {
  // Demo card 's1' (Rotterdam Logistics) exists in tenant A and supports sendFollowUp.
  // Tenant B must NOT be able to mutate it via POST /cards/:id/actions/:action.
  const DEMO_CARD_ID = 's1';
  const ACTION = 'sendFollowUp';

  it('tenant B POST /cards/:id/actions/:action on a demo card id does NOT mutate tenant A card', async () => {
    // Read the card as tenant A before the attack attempt
    const before = await get(`/cards/${DEMO_CARD_ID}`, A());
    expect(before.status).toBe(200);
    const originalStatus = before.body.status;
    const originalDaysLabel = before.body.daysLabel;

    // Tenant B attempts to run the action on a tenant A card — must fail (404/403/400/500)
    const actionRes = await post(`/cards/${DEMO_CARD_ID}/actions/${ACTION}`, {}, TENANT_B_TOKEN());
    // RLS makes the entity invisible to tenant B → entity.findUnique returns null → 'Card not found' → 400
    // Either a 4xx or 5xx is acceptable; 200 is NOT.
    expect(actionRes.status).not.toBe(200);
    // Must not return tenant A's card data in the response body
    if (actionRes.body && typeof actionRes.body === 'object' && actionRes.body.card) {
      expect(actionRes.body.card.id).not.toBe(DEMO_CARD_ID);
    }

    // Re-read the demo card as tenant A — confirm it is unchanged
    const after = await get(`/cards/${DEMO_CARD_ID}`, A());
    expect(after.status).toBe(200);
    // sendFollowUp sets status:'amber' and daysLabel:'just now' — neither must have been applied
    expect(after.body.status).toBe(originalStatus);
    expect(after.body.daysLabel).toBe(originalDaysLabel);
  });
});
