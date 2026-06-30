import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

// Regression: StageConfig used to be globally unique on (track, stageId), so two
// tenants could not both have e.g. (SALES, 'lead') — and the stage-config PUT
// (delete + recreate under RLS) collided with another tenant's rows and crashed
// the API. The unique is now per-tenant ([tenantId, track, stageId]).
describe('StageConfig is unique per tenant, not globally', () => {
  const A = 'tenant-sc-a', B = 'tenant-sc-b';

  it('two tenants can each own the same (track, stageId)', async () => {
    for (const id of [A, B]) {
      await prisma.tenant.upsert({
        where: { id },
        create: { id, slug: id, name: id, status: 'ACTIVE', region: 'eu' },
        update: {},
      });
    }

    const mk = (tenantId) =>
      prisma.stageConfig.create({
        data: { track: 'SALES', order: 0, stageId: 'lead', label: 'Lead', sla: 3, cta: 'Qualify', tenantId },
      });

    const a = await mk(A);
    // The second tenant with the SAME (track, stageId) must NOT collide anymore.
    const b = await mk(B);
    expect(a.tenantId).toBe(A);
    expect(b.tenantId).toBe(B);

    // ...but a duplicate within the SAME tenant still violates the per-tenant unique.
    await expect(mk(A)).rejects.toMatchObject({ code: 'P2002' });

    // cleanup
    await prisma.stageConfig.deleteMany({ where: { tenantId: { in: [A, B] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [A, B] } } });
  });
});
