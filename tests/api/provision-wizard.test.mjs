// tests/api/provision-wizard.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { post, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
const NON = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');

// FK-safe teardown of a provisioned tenant (mirrors blueprints-mgmt.test.mjs)
async function destroyTenant(tid) {
  await prisma.subscription.deleteMany({ where: { tenantId: tid } });
  await prisma.userScope.deleteMany({ where: { tenantId: tid } });
  await prisma.user.deleteMany({ where: { tenantId: tid } });
  await prisma.fieldRule.deleteMany({ where: { tenantId: tid } });
  await prisma.stageDef.deleteMany({ where: { tenantId: tid } });
  await prisma.stageConfig.deleteMany({ where: { tenantId: tid } });
  await prisma.fieldDef.deleteMany({ where: { tenantId: tid } });
  await prisma.entityType.deleteMany({ where: { tenantId: tid } });
  await prisma.trackDef.deleteMany({ where: { tenantId: tid } });
  await prisma.crossTrigger.deleteMany({ where: { tenantId: tid } });
  await prisma.role.deleteMany({ where: { tenantId: tid } });
  await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
  await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
  await prisma.tenant.delete({ where: { id: tid } });
}

const created = [];
afterAll(async () => {
  for (const tid of created) { try { await destroyTenant(tid); } catch {} }
  await prisma.$disconnect();
});

describe('provision overrides', () => {
  it('honours admin + planKey overrides', async () => {
    const r = await post('/platform/tenants', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 's4-ovr', customerName: 'S4 Override Co' },
      admin: { name: 'Wizard Admin', email: 'wizard.admin@s4ovr.test' },
      planKey: 'pro',
      idempotencyKey: 's4-ovr-1',
    }, PLATFORM());
    expect(r.status).toBe(201);
    const tid = r.body.tenantId;
    created.push(tid);
    // admin user carries the overridden email + name
    const admin = await prisma.user.findFirst({ where: { tenantId: tid, email: 'wizard.admin@s4ovr.test' } });
    expect(admin).toBeTruthy();
    expect(admin.name).toBe('Wizard Admin');
    // subscription is the overridden plan
    const sub = await prisma.subscription.findUnique({ where: { tenantId: tid }, include: { plan: true } });
    expect(sub?.plan?.key).toBe('pro');
  });

  it('rejects an invalid admin email (400)', async () => {
    const r = await post('/platform/tenants', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 's4-bad', customerName: 'Bad' },
      admin: { email: 'not-an-email' },
      idempotencyKey: 's4-bad-1',
    }, PLATFORM());
    expect(r.status).toBe(400);
  });
});
