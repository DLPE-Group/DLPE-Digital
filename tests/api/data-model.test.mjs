import { describe, it, expect } from 'vitest';
import { get, token, ADMIN } from '../helpers.mjs';

const NON_ADMIN = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');

// The data-driven meta-model is exposed read-only to admins.
describe('GET /admin/data-model', () => {
  it('returns the 4 tracks and 6 entity types with fields', async () => {
    const r = await get('/admin/data-model', ADMIN());
    expect(r.status).toBe(200);
    expect(r.body.tracks.map((t) => t.key)).toEqual(['sales', 'operations', 'workshop', 'finance']);

    const types = r.body.types;
    const byKey = Object.fromEntries(types.map((t) => [t.key, t]));
    expect(byKey.contract.kind).toBe('pipeline');
    expect(byKey.contract.trackKey).toBe('sales');
    expect(byKey.vehicle.kind).toBe('reference');
    expect(byKey.vehicle.trackKey).toBe(null);
    // contract carries its field schema (sourced from DATA_TYPES)
    expect(byKey.contract.fields.map((f) => f.key)).toContain('contract_value');
  });

  it('each track carries its ordered stages', async () => {
    const r = await get('/admin/data-model', ADMIN());
    const sales = r.body.tracks.find((t) => t.key === 'sales');
    expect(sales.stages[0].stageId).toBe('lead');
    expect(sales.stages.some((s) => s.stageId === 'contract')).toBe(true);
  });

  it('is admin-only (non-admin gets 403)', async () => {
    const r = await get('/admin/data-model', NON_ADMIN());
    expect(r.status).toBe(403);
  });
});
