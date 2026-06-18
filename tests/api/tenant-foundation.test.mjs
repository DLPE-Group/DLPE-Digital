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

    // spot-check representative scoped tables are all stamped
    // tenantId is now NOT NULL; confirm every row belongs to the demo tenant.
    const demoId = demo.id;
    const totalEntities = await prisma.entity.count();
    const stampedEntities = await prisma.entity.count({ where: { tenantId: demoId } });
    const totalUsers = await prisma.user.count();
    const stampedUsers = await prisma.user.count({ where: { tenantId: demoId } });
    const totalRoles = await prisma.role.count();
    const stampedRoles = await prisma.role.count({ where: { tenantId: demoId } });
    const orphanEntities = totalEntities - stampedEntities;
    const orphanUsers = totalUsers - stampedUsers;
    const orphanRoles = totalRoles - stampedRoles;
    expect(orphanEntities + orphanUsers + orphanRoles).toBe(0);
  });

  it('exposes the tenant on /me/permissions principal', async () => {
    const r = await get('/me/permissions', ADMIN());
    expect(r.status).toBe(200);
    // permissions endpoint echoes the principal; tenantId must be present
    expect(r.body.tenantId ?? r.body.user?.tenantId).toBe('tenant-dlpe-demo');
  });
});
