// tests/api/provision-wizard.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, post, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
const NON = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');

// FK-safe teardown of a provisioned tenant (mirrors blueprints-mgmt.test.mjs)
async function destroyTenant(tid) {
  await prisma.subscription.deleteMany({ where: { tenantId: tid } });
  await prisma.userScope.deleteMany({ where: { tenantId: tid } });
  await prisma.user.deleteMany({ where: { tenantId: tid } });
  await prisma.fieldRule.deleteMany({ where: { tenantId: tid } });
  await prisma.stageDef.deleteMany({ where: { tenantId: tid } });
  await prisma.stageConfig.deleteMany({ where: { tenantId: tid } });
  await prisma.fieldDef.deleteMany({ where: { tenantId: tid } });
  await prisma.entityType.deleteMany({ where: { tenantId: tid } });
  await prisma.trackDef.deleteMany({ where: { tenantId: tid } });
  await prisma.crossTrigger.deleteMany({ where: { tenantId: tid } });
  await prisma.role.deleteMany({ where: { tenantId: tid } });
  await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
  await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
  await prisma.tenant.delete({ where: { id: tid } });
}

const created = [];
afterAll(async () => {
  for (const tid of created) { try { await destroyTenant(tid); } catch {} }
  await prisma.blueprint.deleteMany({ where: { key: { startsWith: 'cap-s4' } } });
  await prisma.$disconnect();
});

describe('provision overrides', () => {
  it('honours admin + planKey overrides', async () => {
    // capture the demo config-only (no seed users/entities) into a fresh blueprint
    const cap = await post('/platform/tenants/tenant-dlpe-demo/capture', { key: 'cap-s4-ovr', name: 'S4 Ovr Template' }, PLATFORM());
    expect(cap.status).toBe(200);
    const r = await post('/platform/tenants', {
      blueprintKey: 'cap-s4-ovr',
      inputs: { slug: 's4-ovr', customerName: 'S4 Override Co' },
      admin: { name: 'Wizard Admin', email: 'wizard.admin@s4ovr.test' },
      planKey: 'pro',
      idempotencyKey: 's4-ovr-1',
    }, PLATFORM());
    expect(r.status).toBe(201);
    const tid = r.body.tenantId;
    created.push(tid);
    const admin = await prisma.user.findFirst({ where: { tenantId: tid, email: 'wizard.admin@s4ovr.test' } });
    expect(admin).toBeTruthy();
    expect(admin.name).toBe('Wizard Admin');
    const sub = await prisma.subscription.findUnique({ where: { tenantId: tid }, include: { plan: true } });
    expect(sub?.plan?.key).toBe('pro');
  });

  it('rejects an invalid admin email (400)', async () => {
    const r = await post('/platform/tenants', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 's4-bad', customerName: 'Bad' },
      admin: { email: 'not-an-email' },
      idempotencyKey: 's4-bad-1',
    }, PLATFORM());
    expect(r.status).toBe(400);
  });
});

describe('preflight', () => {
  it('returns a valid summary for the demo blueprint', async () => {
    // expected counts computed from the stored demo spec — no brittle hardcoding
    const bp = (await get('/platform/blueprints', PLATFORM())).body.find((b) => b.key === 'dlpe-demo');
    const spec = bp.spec;
    const expectRoles = spec.roles.length;

    const r = await post('/platform/provision/preflight', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 's4-pf-fresh', customerName: 'S4 PF Fresh' },
      planKey: 'pro',
    }, PLATFORM());
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.slug).toBe('s4-pf-fresh');
    expect(r.body.slugAvailable).toBe(true);
    expect(r.body.resolvedPlanKey).toBe('pro');
    expect(r.body.planExists).toBe(true);
    expect(r.body.summary.roles).toBe(expectRoles);
    expect(r.body.summary.tracks).toBe(spec.tracks.length);
    expect(r.body.summary.entityTypes).toBe(spec.entityTypes.length);
  });

  it('flags missing required inputs as an error', async () => {
    const r = await post('/platform/provision/preflight', {
      blueprintKey: 'dlpe-demo',
      inputs: {}, // omit required inputs
    }, PLATFORM());
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('flags a taken slug and an unknown plan', async () => {
    // demo slug is taken
    const taken = await post('/platform/provision/preflight', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 'dlpe-demo', customerName: 'X' },
      planKey: 'no-such-plan',
    }, PLATFORM());
    expect(taken.status).toBe(200);
    expect(taken.body.slugAvailable).toBe(false);
    expect(taken.body.issues.some((i) => i.level === 'error')).toBe(true); // taken slug blocks
    expect(taken.body.planExists).toBe(false);
    expect(taken.body.issues.some((i) => i.level === 'warning')).toBe(true); // unknown plan warns
  });

  it('404 on unknown blueprint; 403 for non-admins', async () => {
    expect((await post('/platform/provision/preflight', { blueprintKey: 'nope', inputs: {} }, PLATFORM())).status).toBe(404);
    expect((await req('POST', '/platform/provision/preflight', { body: { blueprintKey: 'dlpe-demo', inputs: {} }, tok: NON() })).status).toBe(403);
  });

  it('flags a malformed admin email as an error', async () => {
    const r = await post('/platform/provision/preflight', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 's4-pf-mail', customerName: 'X' },
      admin: { email: 'not-an-email' },
    }, PLATFORM());
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.issues.some((i) => i.level === 'error' && /email/i.test(i.message))).toBe(true);
  });
});
