// tests/api/provision-idempotency.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
import { SPEC_VERSION } from '@dlpe/shared';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

const SPEC = {
  specVersion: SPEC_VERSION, inputs: [],
  orgStructure: { id: 'grp', kind: 'group', name: 'Idem', code: 'IDM', children: [] },
  roles: [{ id: 'group-admin', name: 'Admin', system: true, tracks: ['All'], edit: 'all', desc: 'a' }],
  fieldRules: [], tracks: [], entityTypes: [], crossTriggers: [],
  adminUser: { idPrefix: 'u', name: 'A', email: 'a@idem.io', roleId: 'group-admin', scopeType: 'group', password: 'demo1234' },
};

describe('provisioning idempotency', () => {
  it('re-running the same idempotencyKey does not duplicate', async () => {
    const { provisionTenant } = await import('../../server/src/domain/provisioning/provisionTenant.ts');
    const { SharedDbTarget } = await import('../../server/src/domain/provisioning/target.ts');
    const args = { blueprint: { spec: SPEC }, inputs: { slug: 'idem-co' }, target: new SharedDbTarget(), idempotencyKey: 'idem-key-1', prismaClient: prisma };
    const r1 = await provisionTenant(args);
    const r2 = await provisionTenant(args);
    expect(r2.tenantId).toBe(r1.tenantId);
    expect(await prisma.tenant.count({ where: { slug: 'idem-co' } })).toBe(1);
    expect(await prisma.user.count({ where: { tenantId: r1.tenantId } })).toBe(1);
    // cleanup
    await prisma.user.deleteMany({ where: { tenantId: r1.tenantId } });
    await prisma.role.deleteMany({ where: { tenantId: r1.tenantId } });
    await prisma.orgNode.deleteMany({ where: { tenantId: r1.tenantId } });
    await prisma.provisioningRun.deleteMany({ where: { tenantId: r1.tenantId } });
    await prisma.tenant.delete({ where: { id: r1.tenantId } });
  });

  it('slug collision from a different idempotencyKey throws structured error', async () => {
    const { provisionTenant } = await import('../../server/src/domain/provisioning/provisionTenant.ts');
    const { SharedDbTarget } = await import('../../server/src/domain/provisioning/target.ts');
    // First provision with key-A owns the slug
    const r1 = await provisionTenant({
      blueprint: { spec: SPEC }, inputs: { slug: 'slug-clash' },
      target: new SharedDbTarget(), idempotencyKey: 'slug-clash-key-a', prismaClient: prisma,
    });
    // Second provision with a DIFFERENT key tries the same slug → must throw
    await expect(
      provisionTenant({
        blueprint: { spec: SPEC }, inputs: { slug: 'slug-clash' },
        target: new SharedDbTarget(), idempotencyKey: 'slug-clash-key-b', prismaClient: prisma,
      })
    ).rejects.toThrow('slug already in use: slug-clash');
    // cleanup
    const tid = r1.tenantId;
    await prisma.user.deleteMany({ where: { tenantId: tid } });
    await prisma.role.deleteMany({ where: { tenantId: tid } });
    await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
    await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
    // Also clean up the failed run for key-b (no tenantId, so look by key)
    await prisma.provisioningRun.deleteMany({ where: { idempotencyKey: 'slug-clash-key-b' } });
    await prisma.tenant.delete({ where: { id: tid } });
  });
});
