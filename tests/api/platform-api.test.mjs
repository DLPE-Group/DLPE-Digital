import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, post, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

// u-robert is seeded as platformAdmin: true in dlpe-demo blueprint — no setup/teardown needed
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
afterAll(async () => {
  await prisma.$disconnect();
});

describe('platform API', () => {
  it('non-platform-admin is 403 on /api/platform', async () => {
    const r = await get('/platform/tenants', token('u-markus', 'm.weber@group.eu', 'sales-mgr'));
    expect(r.status).toBe(403);
  });
  it('platform-admin lists tenants and blueprints', async () => {
    expect((await get('/platform/tenants', PLATFORM())).status).toBe(200);
    expect((await get('/platform/blueprints', PLATFORM())).status).toBe(200);
  });
});
