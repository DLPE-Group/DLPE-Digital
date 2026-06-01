import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
import { entityToCardDTO, entityToVehicleDTO } from '../../server/src/domain/projection.ts';
import { backfillEntities } from '../../server/src/domain/backfill.ts';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

// Earlier test files mutate live Card rows (e.g. the Brussels sign/revert).
// The backfill is convergent, so re-running it here syncs entities to the
// current source rows — making parity independent of test execution order.
beforeAll(async () => {
  await backfillEntities(prisma);
});

// The legacy Card/Vehicle row shaped exactly as listCards/getCard/fleet return it.
function cardToDTO(c) {
  return {
    id: c.id, companyId: c.companyId, track: c.track, type: c.type,
    customer: c.customer, value: c.value, vehicle: c.vehicle, sub: c.sub,
    stageId: c.stageId, stageName: c.stageName, days: c.days, daysLabel: c.daysLabel,
    owner: c.owner, status: c.status, cta: c.cta, sources: c.sources,
    awaitingSign: c.awaitingSign, meta: c.meta, createdById: c.createdById,
  };
}
function vehicleToDTO(v) {
  return {
    id: v.id, plate: v.plate, model: v.model, vin: v.vin, operator: v.operator,
    status: v.status, statusLabel: v.statusLabel, note: v.note, companyId: v.companyId,
  };
}

describe('projection parity: every backfilled entity matches its source row', () => {
  it('every Card has an Entity that projects to the identical Card DTO', async () => {
    const cards = await prisma.card.findMany();
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      const e = await prisma.entity.findUnique({ where: { id: c.id } });
      expect(e, `entity for card ${c.id}`).toBeTruthy();
      expect(entityToCardDTO(e), `card ${c.id}`).toEqual(cardToDTO(c));
    }
  });

  it('every Vehicle has an Entity that projects to the identical Vehicle DTO', async () => {
    const vehicles = await prisma.vehicle.findMany();
    for (const v of vehicles) {
      const e = await prisma.entity.findUnique({ where: { id: v.id } });
      expect(e, `entity for vehicle ${v.id}`).toBeTruthy();
      expect(entityToVehicleDTO(e), `vehicle ${v.id}`).toEqual(vehicleToDTO(v));
    }
  });

  it('every entity carries a tenantId', async () => {
    const orphan = await prisma.entity.count({ where: { tenantId: null } });
    expect(orphan).toBe(0);
  });
});
