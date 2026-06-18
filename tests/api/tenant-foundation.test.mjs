// tests/api/tenant-foundation.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('Tenant foundation', () => {
  it('has a Tenant table and every seeded row carries a tenantId', async () => {
    const tenants = await prisma.tenant.findMany();
    expect(tenants.length).toBeGreaterThanOrEqual(1);
    const demo = tenants.find((t) => t.slug === 'dlpe-demo');
    expect(demo).toBeTruthy();

    // spot-check representative scoped tables are all stamped
    const orphanEntities = await prisma.entity.count({ where: { tenantId: null } });
    const orphanUsers = await prisma.user.count({ where: { tenantId: null } });
    const orphanRoles = await prisma.role.count({ where: { tenantId: null } });
    expect(orphanEntities + orphanUsers + orphanRoles).toBe(0);
  });
});
