import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('ProvisioningTarget', () => {
  it('SharedDbTarget.prepare creates a Tenant; Dedicated throws', async () => {
    const { SharedDbTarget, DedicatedDeploymentTarget } = await import('../../server/src/domain/provisioning/target.ts');
    const ctx = await prisma.$transaction((tx) =>
      new SharedDbTarget().prepare({ slug: 'tgt-test', name: 'Tgt', region: 'eu' }, tx));
    expect(ctx.tenantId).toBeTruthy();
    const t = await prisma.tenant.findUnique({ where: { id: ctx.tenantId } });
    expect(t.slug).toBe('tgt-test');
    await prisma.tenant.delete({ where: { id: ctx.tenantId } });
    await expect(
      prisma.$transaction((tx) => new DedicatedDeploymentTarget().prepare({ slug: 'x', name: 'x', region: 'eu' }, tx)),
    ).rejects.toThrow(/deferred/);
  });
});
