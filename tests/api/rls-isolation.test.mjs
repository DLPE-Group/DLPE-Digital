import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, ADMIN } from '../helpers.mjs';

const APP_URL =
  process.env.APP_TEST_DB_URL ??
  'postgresql://il_app:il_app_pw@localhost:5432/intelligence_test';
const appPrisma = new PrismaClient({ datasources: { db: { url: APP_URL } } });
afterAll(() => appPrisma.$disconnect());

describe('HTTP tenant contract', () => {
  it('GET /cards returns 200 with an array for an authenticated admin', async () => {
    const r = await get('/cards?track=sales', ADMIN());
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });
});

describe('il_app role', () => {
  it('can connect and read as a non-superuser', async () => {
    const n = await appPrisma.tenant.count();
    expect(n).toBeGreaterThanOrEqual(1);
  });
});

describe('withTenant helper', () => {
  it('sets the app.tenant GUC for the transaction', async () => {
    const { appPrisma: helperPrisma, withTenant } = await import('../../server/src/db/withTenant.ts');
    const got = await withTenant('tenant-dlpe-demo', async (tx) => {
      const rows = await tx.$queryRawUnsafe(`SELECT current_setting('app.tenant', true) AS t`);
      return rows[0].t;
    });
    expect(got).toBe('tenant-dlpe-demo');
    await helperPrisma.$disconnect();
  });
});

describe('RLS cross-tenant isolation', () => {
  it("a tenant cannot read another tenant's entities (RLS)", async () => {
    // Dedicated il_app client — always connects as the non-superuser role so RLS is enforced.
    const ILAPP_URL =
      process.env.APP_TEST_DB_URL ??
      'postgresql://il_app:il_app_pw@localhost:5432/intelligence_test';
    const appDb = new PrismaClient({ datasources: { db: { url: ILAPP_URL } } });

    // Local helper that mirrors withTenant but uses appDb (il_app role).
    const asTenant = (tid, fn) =>
      appDb.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant', ${tid}, true)`;
        return fn(tx);
      });

    // owner client (postgres superuser) seeds a 2nd tenant + one entity in it
    const owner = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.OWNER_TEST_DB_URL ??
            'postgresql://postgres:postgres@localhost:5432/intelligence_test',
        },
      },
    });

    await owner.tenant.upsert({
      where: { slug: 'tenant-b' },
      update: {},
      create: { id: 'tnt-b', slug: 'tenant-b', name: 'Tenant B' },
    });

    const anyType = await owner.entityType.findFirst();
    if (!anyType) throw new Error('No EntityType found in test DB — run prepare-db first');

    // Clean up any leftover from a previous run
    await owner.entity.deleteMany({ where: { id: 'ent-b-secret' } });

    await owner.entity.create({
      data: {
        id: 'ent-b-secret',
        tenantId: 'tnt-b',
        entityTypeId: anyType.id,
        title: 'B-only secret',
      },
    });

    // as tenant A (demo): must NOT see tenant B's entity — RLS enforced via il_app role
    const visibleToA = await asTenant('tenant-dlpe-demo', (tx) =>
      tx.entity.findMany({ where: { id: 'ent-b-secret' } }),
    );
    expect(visibleToA).toHaveLength(0);

    // as tenant B: sees its own entity
    const visibleToB = await asTenant('tnt-b', (tx) =>
      tx.entity.findMany({ where: { id: 'ent-b-secret' } }),
    );
    expect(visibleToB).toHaveLength(1);

    // Clean up
    await owner.entity.deleteMany({ where: { id: 'ent-b-secret' } });
    await owner.tenant.deleteMany({ where: { id: 'tnt-b' } });
    await owner.$disconnect();
    await appDb.$disconnect();
  });
});
