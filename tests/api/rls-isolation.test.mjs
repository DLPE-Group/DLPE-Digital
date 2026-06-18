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
