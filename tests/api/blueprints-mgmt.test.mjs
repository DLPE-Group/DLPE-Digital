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
});
