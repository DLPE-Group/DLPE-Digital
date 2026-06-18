import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('Blueprint + ProvisioningRun tables', () => {
  it('can create and read a Blueprint row', async () => {
    const bp = await prisma.blueprint.create({
      data: { key: 'tmp-bp', name: 'Tmp', version: 1, status: 'DRAFT', spec: { specVersion: 1 } },
    });
    expect(bp.id).toBeTruthy();
    await prisma.blueprint.delete({ where: { id: bp.id } });
  });
  it('User has a platformAdmin flag defaulting false', async () => {
    const u = await prisma.user.findUnique({ where: { id: 'u-robert' } });
    expect(u.platformAdmin).toBe(false);
  });
});
