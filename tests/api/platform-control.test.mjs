import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, patch, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
const NON = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');
afterAll(() => prisma.$disconnect());

describe('control plane backend', () => {
  it('/me/permissions exposes platformAdmin (true for demo r.mertens)', async () => {
    const r = await get('/me/permissions', PLATFORM());
    expect(r.status).toBe(200);
    expect(r.body.platformAdmin).toBe(true);
  });
  it('PATCH /platform/tenants/:id flips status; guards', async () => {
    const susp = await patch('/platform/tenants/tenant-dlpe-demo', { status: 'SUSPENDED' }, PLATFORM());
    expect(susp.status).toBe(200); expect(susp.body.status).toBe('SUSPENDED');
    const back = await patch('/platform/tenants/tenant-dlpe-demo', { status: 'ACTIVE' }, PLATFORM());
    expect(back.body.status).toBe('ACTIVE');
    expect((await patch('/platform/tenants/tenant-dlpe-demo', { status: 'NOPE' }, PLATFORM())).status).toBe(400);
    expect((await patch('/platform/tenants/does-not-exist', { status: 'ACTIVE' }, PLATFORM())).status).toBe(404);
    expect((await req('PATCH', '/platform/tenants/tenant-dlpe-demo', { body: { status: 'ACTIVE' }, tok: NON() })).status).toBe(403);
  });
});
