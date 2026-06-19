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

describe('SimulatedBillingProvider', () => {
  it('creates + changes a subscription', async () => {
    const { SimulatedBillingProvider } = await import('../../server/src/domain/billing/provider.ts');
    // pass the test-DB prisma so the provider uses intelligence_test, not the default DB
    const bp = new SimulatedBillingProvider(prisma);
    // a throwaway tenant
    const t = await prisma.tenant.create({ data: { slug: 'bill-test', name: 'Bill', region: 'eu' } });
    const s1 = await bp.createSubscription({ tenantId: t.id, planKey: 'starter' });
    expect(s1.planKey).toBe('starter'); expect(['ACTIVE','TRIALING']).toContain(s1.status);
    const s2 = await bp.changePlan({ tenantId: t.id, planKey: 'pro' });
    expect(s2.planKey).toBe('pro');
    await prisma.subscription.deleteMany({ where: { tenantId: t.id } });
    await prisma.tenant.delete({ where: { id: t.id } });
  });
});
