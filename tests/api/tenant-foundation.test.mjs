// tests/api/tenant-foundation.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL, get, ADMIN } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('Tenant foundation', () => {
  it('has a Tenant table and every seeded row carries a tenantId', async () => {
    const tenants = await prisma.tenant.findMany();
    expect(tenants.length).toBeGreaterThanOrEqual(1);
    const demo = tenants.find((t) => t.slug === 'dlpe-demo');
    expect(demo).toBeTruthy();

    // spot-check representative scoped tables carry a REAL tenant id (no orphans).
    // The test DB may hold more than one tenant (the demo plus the non-fleet UI
    // fixture), so check "tenantId ∈ known tenants", not "== demo".
    const demoId = demo.id;
    const ids = tenants.map((t) => t.id);
    const orphanEntities = await prisma.entity.count({ where: { tenantId: { notIn: ids } } });
    const orphanUsers = await prisma.user.count({ where: { tenantId: { notIn: ids } } });
    const orphanRoles = await prisma.role.count({ where: { tenantId: { notIn: ids } } });
    expect(orphanEntities + orphanUsers + orphanRoles).toBe(0);
    // …and the demo tenant itself is populated.
    expect(await prisma.entity.count({ where: { tenantId: demoId } })).toBeGreaterThan(0);
  });

  it('exposes the tenant on /me/permissions principal', async () => {
    const r = await get('/me/permissions', ADMIN());
    expect(r.status).toBe(200);
    // permissions endpoint echoes the principal; tenantId must be present
    expect(r.body.tenantId ?? r.body.user?.tenantId).toBe('tenant-dlpe-demo');
  });
});
