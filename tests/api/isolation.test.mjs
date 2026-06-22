import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, token, TEST_DB_URL } from '../helpers.mjs';
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
