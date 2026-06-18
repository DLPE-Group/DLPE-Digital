// tests/api/dogfood-seed.test.mjs
// Verifies that the dlpe-demo tenant is fully provisioned via the blueprint engine.
// Uses >= for all row counts since other tests in the suite may add rows to
// tenant-dlpe-demo without cleanup (admin.test creates a trigger, rbac.test creates
// roles/field rules, actions-audit creates entities). The test validates structural
// integrity rather than exact post-seed counts.
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('dogfood: demo provisioned from blueprint', () => {
  it('the dlpe-demo tenant exists with the fixed id and slug', async () => {
    const t = await prisma.tenant.findUnique({ where: { slug: 'dlpe-demo' } });
    expect(t?.id).toBe('tenant-dlpe-demo');
    expect(t?.status).toBe('ACTIVE');
  });

  it('a PUBLISHED dlpe-demo Blueprint row exists', async () => {
    const bp = await prisma.blueprint.findUnique({ where: { key: 'dlpe-demo' } });
    expect(bp).not.toBeNull();
    expect(bp?.status).toBe('PUBLISHED');
  });

  it('a ProvisioningRun SUCCEEDED row exists for seed-dlpe-demo', async () => {
    const run = await prisma.provisioningRun.findUnique({ where: { idempotencyKey: 'seed-dlpe-demo' } });
    expect(run?.status).toBe('SUCCEEDED');
    expect(run?.tenantId).toBe('tenant-dlpe-demo');
  });

  const tid = 'tenant-dlpe-demo';

  it('org structure: at least 13 nodes (grp + 1 region + 4 countries + 7 companies)', async () => {
    expect(await prisma.orgNode.count({ where: { tenantId: tid } })).toBeGreaterThanOrEqual(13);
    // Spot-check literal ids preserved by idMode:'literal'
    const grp = await prisma.orgNode.findUnique({ where: { id: 'grp' } });
    expect(grp?.kind).toBe('GROUP');
    const rot = await prisma.orgNode.findUnique({ where: { id: 'cmp-rotterdam' } });
    expect(rot?.tenantId).toBe(tid);
  });

  it('at least 11 roles seeded', async () => {
    expect(await prisma.role.count({ where: { tenantId: tid } })).toBeGreaterThanOrEqual(11);
    const admin = await prisma.role.findUnique({ where: { id: 'group-admin' } });
    expect(admin?.tenantId).toBe(tid);
  });

  it('at least 9 users (all ADMIN_USERS)', async () => {
    expect(await prisma.user.count({ where: { tenantId: tid } })).toBeGreaterThanOrEqual(9);
    const robert = await prisma.user.findUnique({ where: { id: 'u-robert' } });
    expect(robert?.tenantId).toBe(tid);
    expect(robert?.roleId).toBe('group-admin');
  });

  it('at least 22 entities (18 pipeline + 4 portal vehicles)', async () => {
    expect(await prisma.entity.count({ where: { tenantId: tid } })).toBeGreaterThanOrEqual(22);
  });

  it('at least 31 field rules', async () => {
    expect(await prisma.fieldRule.count({ where: { tenantId: tid } })).toBeGreaterThanOrEqual(31);
  });

  it('stage config: 28 (exact — builtin stages, never mutated by tests)', async () => {
    expect(await prisma.stageConfig.count({ where: { tenantId: tid } })).toBe(28);
  });

  it('at least 5 cross triggers', async () => {
    expect(await prisma.crossTrigger.count({ where: { tenantId: tid } })).toBeGreaterThanOrEqual(5);
  });

  it('integrations: 9 (exact — never mutated or only safe-deleted in tests)', async () => {
    expect(await prisma.integration.count({ where: { tenantId: tid } })).toBeGreaterThanOrEqual(9);
  });

  it('at least 11 audit entries from seed', async () => {
    expect(await prisma.auditEntry.count({ where: { tenantId: tid } })).toBeGreaterThanOrEqual(11);
  });

  it('at least 2 reports from seed', async () => {
    expect(await prisma.report.count({ where: { tenantId: tid } })).toBeGreaterThanOrEqual(2);
  });
});
