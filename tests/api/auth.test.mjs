import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { get, post, ADMIN, TEST_DB_URL } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

describe('auth', () => {
  it('health is public', async () => {
    const r = await get('/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it('rejects unauthenticated access to a secured route', async () => {
    const r = await get('/cards?track=sales');
    expect(r.status).toBe(401);
  });

  it('logs in with seeded credentials', async () => {
    const r = await post('/auth/login', { email: 'm.weber@group.eu', password: 'demo1234' });
    expect(r.status).toBe(200);
    expect(typeof r.body.token).toBe('string');
    expect(r.body.user.email).toBe('m.weber@group.eu');
  });

  it('rejects bad credentials', async () => {
    const r = await post('/auth/login', { email: 'm.weber@group.eu', password: 'wrong' });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('returns the current user from a valid token', async () => {
    const r = await get('/auth/me', ADMIN());
    expect(r.status).toBe(200);
    expect(r.body.roleId).toBe('group-admin');
  });
});

// Regression: login must work for a user in a NON-demo tenant.
// Before the issueRefresh fix, Session.create failed with a tenantId FK violation
// for any tenant other than 'tenant-dlpe-demo'.
describe('auth — non-demo tenant login regression', () => {
  const TENANT_ID = 'tenant-logintest';
  const ROLE_ID = 'logintest-admin';
  const USER_ID = 'u-logintest';
  const USER_EMAIL = 'logintest@logintest.example';
  const PASSWORD = 'LoginTest123!';

  beforeAll(async () => {
    const passwordHash = await argon2.hash(PASSWORD);
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      create: { id: TENANT_ID, slug: 'logintest', name: 'Login Test Tenant', status: 'ACTIVE', region: 'eu' },
      update: {},
    });
    await prisma.role.upsert({
      where: { id: ROLE_ID },
      create: { id: ROLE_ID, name: 'Admin', system: true, tracks: [], edit: 'all', desc: 'test admin', tenantId: TENANT_ID },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: USER_ID },
      create: {
        id: USER_ID, name: 'Login Test User', email: USER_EMAIL,
        passwordHash, roleId: ROLE_ID, scopeType: 'group',
        status: 'active', platformAdmin: false, tenantId: TENANT_ID,
      },
      update: { passwordHash },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.role.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
    await prisma.$disconnect();
  });

  it('can log in as a user in a non-demo tenant (session FK must be correct tenantId)', async () => {
    const r = await post('/auth/login', { email: USER_EMAIL, password: PASSWORD });
    expect(r.status).toBe(200);
    expect(typeof r.body.token).toBe('string');

    // Verify a Session row was created with the correct tenantId (not demo tenant)
    const sessions = await prisma.session.findMany({ where: { tenantId: TENANT_ID } });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].tenantId).toBe(TENANT_ID);
    expect(sessions[0].tenantId).not.toBe('tenant-dlpe-demo');
  });
});
