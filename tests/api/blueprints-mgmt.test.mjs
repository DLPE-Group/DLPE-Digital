// tests/api/blueprints-mgmt.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, post, patch, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
const NON = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');

afterAll(async () => {
  await prisma.blueprint.deleteMany({ where: { key: { startsWith: 'cap-' } } });
  await prisma.$disconnect();
});

describe('blueprint management', () => {
  it('captures the demo tenant into a DRAFT blueprint', async () => {
    const r = await post('/platform/tenants/tenant-dlpe-demo/capture', { key: 'cap-demo', name: 'Captured demo' }, PLATFORM());
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('DRAFT');
    expect(r.body.sourceTenantId).toBe('tenant-dlpe-demo');
    // the captured spec is a valid BlueprintSpec (roles/tracks present)
    expect(Array.isArray(r.body.spec.roles)).toBe(true);
    expect(r.body.spec.roles.length).toBeGreaterThan(0);
  });
  it('publishes then archives a blueprint', async () => {
    const id = (await get('/platform/blueprints', PLATFORM())).body.find((b) => b.key === 'cap-demo').id;
    expect((await patch(`/platform/blueprints/${id}`, { status: 'PUBLISHED' }, PLATFORM())).body.status).toBe('PUBLISHED');
    expect((await patch(`/platform/blueprints/${id}`, { status: 'ARCHIVED' }, PLATFORM())).body.status).toBe('ARCHIVED');
    expect((await patch(`/platform/blueprints/${id}`, { status: 'NOPE' }, PLATFORM())).status).toBe(400);
  });
  it('rejects duplicate capture key (409) and gates non-admins (403)', async () => {
    expect((await post('/platform/tenants/tenant-dlpe-demo/capture', { key: 'cap-demo', name: 'dup' }, PLATFORM())).status).toBe(409);
    expect((await req('POST', '/platform/tenants/tenant-dlpe-demo/capture', { body: { key: 'cap-x', name: 'x' }, tok: NON() })).status).toBe(403);
  });
  it('a captured blueprint can provision a new tenant (round-trip)', async () => {
    // capture the demo tenant under a fresh key
    const cap = await post('/platform/tenants/tenant-dlpe-demo/capture', { key: 'cap-rt', name: 'RT' }, PLATFORM());
    expect(cap.status).toBe(200);
    // provision a new tenant from the captured blueprint (prefixed id mode — default)
    const prov = await post('/platform/tenants', { blueprintKey: 'cap-rt', inputs: { slug: 'rt-clone', customerName: 'RT Clone' }, idempotencyKey: 'cap-rt-1' }, PLATFORM());
    expect(prov.status).toBe(201);
    const tid = prov.body.tenantId;
    expect(tid).toBeTruthy();
    // the clone has org nodes + roles under its own tenantId (captured from the demo)
    expect(await prisma.role.count({ where: { tenantId: tid } })).toBeGreaterThan(0);
    expect(await prisma.orgNode.count({ where: { tenantId: tid } })).toBeGreaterThan(0);
    // cleanup the provisioned clone FK-safe (mirrors provision-tenant.test.mjs + fieldRule/fieldDef from capture)
    await prisma.subscription.deleteMany({ where: { tenantId: tid } });
    await prisma.user.deleteMany({ where: { tenantId: tid } });
    await prisma.fieldRule.deleteMany({ where: { tenantId: tid } });
    await prisma.stageDef.deleteMany({ where: { tenantId: tid } });
    await prisma.stageConfig.deleteMany({ where: { tenantId: tid } });
    await prisma.fieldDef.deleteMany({ where: { tenantId: tid } });
    await prisma.entityType.deleteMany({ where: { tenantId: tid } });
    await prisma.trackDef.deleteMany({ where: { tenantId: tid } });
    await prisma.crossTrigger.deleteMany({ where: { tenantId: tid } });
    await prisma.userScope.deleteMany({ where: { tenantId: tid } });
    await prisma.role.deleteMany({ where: { tenantId: tid } });
    await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
    await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
    await prisma.tenant.delete({ where: { id: tid } });
  });
});
