import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

// Phase 4: Entity is the sole data model. These guard the seeded shape now that
// Card/Vehicle are gone.
describe('entity model integrity (post Card/Vehicle drop)', () => {
  it('seeds 18 pipeline + 4 reference entities, all tenant-stamped', async () => {
    // tenantId is NOT NULL post-Task-2; verify all rows are stamped via NOT empty string
    const [pipeline, reference, total, stamped] = await Promise.all([
      prisma.entity.count({ where: { entityType: { kind: 'pipeline' } } }),
      prisma.entity.count({ where: { entityType: { kind: 'reference' } } }),
      prisma.entity.count(),
      prisma.entity.count({ where: { tenantId: { not: '' } } }),
    ]);
    expect(pipeline).toBe(18);
    expect(reference).toBe(4);
    expect(total - stamped).toBe(0); // all rows have a non-empty tenantId
  });

  it('every pipeline entity has a track + stage; reference entities have neither', async () => {
    const entities = await prisma.entity.findMany({ include: { entityType: true } });
    for (const e of entities) {
      if (e.entityType.kind === 'pipeline') {
        expect(e.trackId, `pipeline ${e.id} trackId`).toBeTruthy();
        expect(e.stageId, `pipeline ${e.id} stageId`).toBeTruthy();
      } else {
        expect(e.trackId).toBeNull();
      }
    }
  });

  it('the legacy Card/Vehicle tables no longer exist', async () => {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Card','Vehicle')`,
    );
    expect(rows[0].n).toBe(0);
  });
});
