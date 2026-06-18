import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, post, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

// a platform-admin principal + a normal (tenant) admin
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
beforeAll(async () => { await prisma.user.update({ where: { id: 'u-robert' }, data: { platformAdmin: true } }); });
afterAll(async () => {
  await prisma.user.update({ where: { id: 'u-robert' }, data: { platformAdmin: false } });
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
