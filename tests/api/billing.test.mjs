// tests/api/billing.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('billing model + seed', () => {
  it('seeds 3 plans', async () => {
    const plans = await prisma.plan.findMany();
    expect(plans.map((p) => p.key).sort()).toEqual(['enterprise', 'pro', 'starter']);
    const starter = plans.find((p) => p.key === 'starter');
    expect(starter.entitlements.limits.maxUsers).toBe(10);
  });
  it('demo tenant has an enterprise ACTIVE subscription', async () => {
    const sub = await prisma.subscription.findUnique({ where: { tenantId: 'tenant-dlpe-demo' }, include: { plan: true } });
    expect(sub.plan.key).toBe('enterprise');
    expect(sub.status).toBe('ACTIVE');
  });
});
