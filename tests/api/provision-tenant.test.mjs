import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
import { SPEC_VERSION } from '@dlpe/shared';
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

const SMALL_SPEC = {
  specVersion: SPEC_VERSION,
  inputs: [{ key: 'customerName', label: 'Customer', type: 'string', required: true }],
  orgStructure: { id: 'grp', kind: 'group', name: 'Acme Group', code: 'ACME', children: [
    { id: 'cmp-acme', kind: 'company', name: 'Acme Co', code: 'ACME-1', children: [] } ] },
  roles: [{ id: 'group-admin', name: 'Group admin', system: true, tracks: ['All'], edit: 'all', desc: 'admin' }],
  fieldRules: [],
  tracks: [{ key: 'sales', label: 'Sales', order: 0, builtin: true, stages: [
    { stageId: 'lead', label: 'Lead', sla: 0, cta: 'Qualify', order: 0 } ] }],
  entityTypes: [{ key: 'contract', label: 'Contract', kind: 'pipeline', trackKey: 'sales', order: 0, builtin: true, fields: [] }],
  crossTriggers: [],
  adminUser: { idPrefix: 'u', name: 'Acme Admin', email: 'admin@acme.io', roleId: 'group-admin', scopeType: 'group', password: 'demo1234' },
};

describe('provisionTenant', () => {
  it('provisions a complete isolated tenant from a blueprint', async () => {
    const { provisionTenant } = await import('../../server/src/domain/provisioning/provisionTenant.ts');
    const { SharedDbTarget } = await import('../../server/src/domain/provisioning/target.ts');
    const res = await provisionTenant({
      blueprint: { spec: SMALL_SPEC }, inputs: { customerName: 'Acme' },
      target: new SharedDbTarget(), idempotencyKey: 'test-acme-1',
      prismaClient: prisma,
    });
    expect(res.tenantId).toBeTruthy();
    const tid = res.tenantId;
    expect(await prisma.orgNode.count({ where: { tenantId: tid } })).toBe(2);
    expect(await prisma.role.count({ where: { tenantId: tid } })).toBe(1);
    expect(await prisma.trackDef.count({ where: { tenantId: tid } })).toBe(1);
    expect(await prisma.entityType.count({ where: { tenantId: tid } })).toBe(1);
    expect(await prisma.user.count({ where: { tenantId: tid } })).toBe(1);
    // cleanup
    await prisma.user.deleteMany({ where: { tenantId: tid } });
    await prisma.stageDef.deleteMany({ where: { tenantId: tid } });
    await prisma.stageConfig.deleteMany({ where: { tenantId: tid } });
    await prisma.entityType.deleteMany({ where: { tenantId: tid } });
    await prisma.trackDef.deleteMany({ where: { tenantId: tid } });
    await prisma.role.deleteMany({ where: { tenantId: tid } });
    await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
    await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
    await prisma.tenant.delete({ where: { id: tid } });
  });

  it('rejects inputs that miss a required field', async () => {
    const { provisionTenant } = await import('../../server/src/domain/provisioning/provisionTenant.ts');
    const { SharedDbTarget } = await import('../../server/src/domain/provisioning/target.ts');
    await expect(provisionTenant({
      blueprint: { spec: SMALL_SPEC }, inputs: {}, target: new SharedDbTarget(), idempotencyKey: 'test-acme-bad',
      prismaClient: prisma,
    })).rejects.toThrow(/customerName/);
  });

  it('idMode literal: ids are unprefixed and spec.users[] are created', async () => {
    const { provisionTenant } = await import('../../server/src/domain/provisioning/provisionTenant.ts');
    const { SharedDbTarget } = await import('../../server/src/domain/provisioning/target.ts');

    // Literal mode is designed for dedicated deployments where ids don't collide.
    // In the shared test DB the demo seed already owns 'grp', 'group-admin', 'sales' etc.,
    // so we use deliberately distinct literal ids that still prove verbatim id storage.
    const LIT_SPEC = {
      specVersion: SPEC_VERSION,
      inputs: [{ key: 'customerName', label: 'Customer', type: 'string', required: true }],
      orgStructure: { id: 'lit-grp', kind: 'group', name: 'Lit Group', code: 'LIT', children: [] },
      roles: [{ id: 'lit-admin-role', name: 'Lit admin', system: true, tracks: ['All'], edit: 'all', desc: 'admin' }],
      fieldRules: [],
      tracks: [],
      entityTypes: [],
      crossTriggers: [],
      adminUser: { idPrefix: 'u-lit-admin', name: 'Lit Admin', email: 'admin@lit.io', roleId: 'lit-admin-role', scopeType: 'group', password: 'demo1234' },
      users: [
        { id: 'u-lit', name: 'Lit', email: 'lit@x.io', roleId: 'lit-admin-role', scopeType: 'group', password: 'demo1234' },
      ],
    };

    const res = await provisionTenant({
      blueprint: { spec: LIT_SPEC },
      inputs: { customerName: 'Lit Co' },
      target: new SharedDbTarget(),
      idMode: 'literal',
      idempotencyKey: 'test-lit-1',
      prismaClient: prisma,
    });
    expect(res.tenantId).toBeTruthy();
    const tid = res.tenantId;

    // Role id must be verbatim (not prefixed with slug — e.g. NOT 'lit-co-lit-admin-role')
    const role = await prisma.role.findUnique({ where: { id: 'lit-admin-role' } });
    expect(role).not.toBeNull();
    expect(role.tenantId).toBe(tid);

    // spec.users[] user must exist with literal id
    const litUser = await prisma.user.findUnique({ where: { id: 'u-lit' } });
    expect(litUser).not.toBeNull();
    expect(litUser.tenantId).toBe(tid);

    // admin user id is idPrefix verbatim (not idPrefix-slug — e.g. NOT 'u-lit-admin-lit-co')
    const adminUser = await prisma.user.findUnique({ where: { id: 'u-lit-admin' } });
    expect(adminUser).not.toBeNull();
    expect(adminUser.tenantId).toBe(tid);

    // cleanup
    await prisma.userScope.deleteMany({ where: { tenantId: tid } });
    await prisma.user.deleteMany({ where: { tenantId: tid } });
    await prisma.stageDef.deleteMany({ where: { tenantId: tid } });
    await prisma.stageConfig.deleteMany({ where: { tenantId: tid } });
    await prisma.entityType.deleteMany({ where: { tenantId: tid } });
    await prisma.trackDef.deleteMany({ where: { tenantId: tid } });
    await prisma.role.deleteMany({ where: { tenantId: tid } });
    await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
    await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
    await prisma.tenant.delete({ where: { id: tid } });
  });
});
