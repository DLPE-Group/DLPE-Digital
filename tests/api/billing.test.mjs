// tests/api/billing.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL, token, post, get, patch, req } from '../helpers.mjs';
import { SPEC_VERSION } from '@dlpe/shared';
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

describe('entitlement helpers', () => {
  it('entitlement helpers reflect the demo enterprise plan', async () => {
    const ent = await import('../../server/src/domain/billing/entitlements.ts');
    expect(await ent.isBillableActive('tenant-dlpe-demo', prisma)).toBe(true);
    expect(await ent.tenantHasFeature('tenant-dlpe-demo', 'sso', prisma)).toBe(true);
    // enterprise has no maxUsers limit → within limit regardless of count
    expect(await ent.tenantWithinLimit('tenant-dlpe-demo', 'maxUsers', 9999, prisma)).toBe(true);
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

describe('maxUsers gate on POST /admin/users', () => {
  it('blocks the 11th user create (402) on starter; allows after upgrade to pro (200)', async () => {
    const { SimulatedBillingProvider } = await import('../../server/src/domain/billing/provider.ts');
    const bp = new SimulatedBillingProvider(prisma);

    // --- arrange: throwaway tenant on starter (maxUsers 10) ---
    const t = await prisma.tenant.create({ data: { slug: 'cap-test', name: 'Cap Test', region: 'eu' } });
    await bp.createSubscription({ tenantId: t.id, planKey: 'starter' });

    // Create a tenant-local admin role (ends with -group-admin so requireAdmin passes).
    // This must be tenant-owned so RLS allows reading it via withTenant in POST /admin/users.
    const capAdminRoleId = 'cap-group-admin';
    await prisma.role.create({
      data: { id: capAdminRoleId, name: 'Group Admin', system: true, tracks: [], edit: 'all', desc: 'admin', tenantId: t.id },
    });

    const adminId = 'u-cap-admin';
    const adminEmail = 'cap.admin@cap-test.io';
    await prisma.user.create({
      data: {
        id: adminId,
        name: 'Cap Admin',
        email: adminEmail,
        initials: 'CA',
        passwordHash: 'x',
        roleId: capAdminRoleId,
        scopeType: 'group',
        status: 'active',
        tenantId: t.id,
      },
    });

    // Seed 9 more users to bring the total to 10 (admin + 9 = 10 = maxUsers for starter)
    for (let i = 1; i <= 9; i++) {
      await prisma.user.create({
        data: {
          id: `u-cap-fill-${i}`,
          name: `Fill ${i}`,
          email: `fill${i}@cap-test.io`,
          initials: `F${i}`,
          passwordHash: 'x',
          roleId: capAdminRoleId,
          scopeType: 'group',
          status: 'active',
          tenantId: t.id,
        },
      });
    }

    const tok = token(adminId, adminEmail, capAdminRoleId);

    // --- act: attempt to create the 11th user → expect 402 ---
    const r1 = await post('/admin/users', {
      name: 'Over Limit',
      email: 'overlimit@cap-test.io',
      roleId: capAdminRoleId,
      scopeType: 'group',
    }, tok);
    expect(r1.status).toBe(402);
    expect(r1.body.limit).toBe(10);
    expect(r1.body.current).toBe(10);

    // --- upgrade to pro (maxUsers 50) → create should succeed ---
    await bp.changePlan({ tenantId: t.id, planKey: 'pro' });
    const r2 = await post('/admin/users', {
      id: 'u-cap-new',
      name: 'Now Allowed',
      email: 'nowallowed@cap-test.io',
      roleId: capAdminRoleId,
      scopeType: 'group',
    }, tok);
    expect(r2.status).toBe(200);
    expect(r2.body.id).toBe('u-cap-new');

    // --- cleanup: FK-safe order ---
    await prisma.user.deleteMany({ where: { tenantId: t.id } });
    await prisma.role.deleteMany({ where: { tenantId: t.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: t.id } });
    await prisma.tenant.delete({ where: { id: t.id } });
  });
});

describe('platform billing API', () => {
  const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
  const NON = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');

  // Unconditionally restore demo tenant to enterprise/ACTIVE after this describe block,
  // regardless of whether any assertion failed mid-test (same isolation class as S3 bug).
  afterAll(async () => {
    const enterprise = await prisma.plan.findUnique({ where: { key: 'enterprise' } });
    if (enterprise) {
      await prisma.subscription.update({
        where: { tenantId: 'tenant-dlpe-demo' },
        data: { planId: enterprise.id, status: 'ACTIVE' },
      });
    }
  });

  it('platform billing API: list plans, read + change a tenant subscription; gated', async () => {
    expect((await get('/platform/plans', PLATFORM())).body.length).toBe(3);
    const subR = await get('/platform/tenants/tenant-dlpe-demo/subscription', PLATFORM());
    expect(subR.body.plan.key).toBe('enterprise');
    const ch = await patch('/platform/tenants/tenant-dlpe-demo/subscription', { planKey: 'pro' }, PLATFORM());
    expect(ch.status).toBe(200); expect(ch.body.planKey).toBe('pro');
    await patch('/platform/tenants/tenant-dlpe-demo/subscription', { planKey: 'enterprise' }, PLATFORM()); // restore (belt)
    expect((await req('GET', '/platform/plans', { tok: NON() })).status).toBe(403);
  });
});

describe('provisionTenant default subscription', () => {
  it('provisionTenant assigns the blueprint default plan as a TRIALING subscription', async () => {
    const { provisionTenant } = await import('../../server/src/domain/provisioning/provisionTenant.ts');
    const { SharedDbTarget } = await import('../../server/src/domain/provisioning/target.ts');
    const spec = { specVersion: SPEC_VERSION, defaultPlanKey: 'pro', inputs: [],
      orgStructure: { id: 'grp', kind: 'group', name: 'Bp', code: 'BP', children: [] },
      roles: [{ id: 'group-admin', name: 'A', system: true, tracks: ['All'], edit: 'a', desc: 'a' }],
      fieldRules: [], tracks: [], entityTypes: [], crossTriggers: [],
      adminUser: { idPrefix: 'u', name: 'A', email: 'a@bp.io', roleId: 'group-admin', scopeType: 'group', password: 'demo1234' } };
    const r = await provisionTenant({ blueprint: { spec }, inputs: { slug: 'bp-sub' }, target: new SharedDbTarget(), idempotencyKey: 'bp-sub-1', prismaClient: prisma });
    const sub = await prisma.subscription.findUnique({ where: { tenantId: r.tenantId }, include: { plan: true } });
    expect(sub.plan.key).toBe('pro'); expect(sub.status).toBe('TRIALING');
    // cleanup
    await prisma.subscription.deleteMany({ where: { tenantId: r.tenantId } });
    await prisma.user.deleteMany({ where: { tenantId: r.tenantId } });
    await prisma.role.deleteMany({ where: { tenantId: r.tenantId } });
    await prisma.orgNode.deleteMany({ where: { tenantId: r.tenantId } });
    await prisma.provisioningRun.deleteMany({ where: { tenantId: r.tenantId } });
    await prisma.tenant.delete({ where: { id: r.tenantId } });
  });
});
