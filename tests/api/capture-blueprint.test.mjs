import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
import { BlueprintSpec } from '@dlpe/shared';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('captureBlueprint', () => {
  it('captures the demo tenant config into a valid BlueprintSpec', async () => {
    const { captureBlueprint } = await import('../../server/src/domain/provisioning/captureBlueprint.ts');
    const spec = await captureBlueprint(prisma, 'tenant-dlpe-demo');
    expect(BlueprintSpec.safeParse(spec).success).toBe(true);
    expect(spec.roles.length).toBeGreaterThan(0);
    expect(spec.tracks.length).toBeGreaterThan(0);
    expect(spec.orgStructure.kind).toBe('group');
    expect(spec.seed).toBeUndefined(); // config only, no business rows
  });
});
