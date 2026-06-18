import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const APP_URL =
  process.env.APP_TEST_DB_URL ??
  'postgresql://il_app:il_app_pw@localhost:5432/intelligence_test';
const appPrisma = new PrismaClient({ datasources: { db: { url: APP_URL } } });
afterAll(() => appPrisma.$disconnect());

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
