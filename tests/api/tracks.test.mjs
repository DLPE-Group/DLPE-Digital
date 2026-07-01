import { describe, it, expect } from 'vitest';
import { get, ADMIN, token } from '../helpers.mjs';

// GET /tracks is the data-model-driven track set that powers the dashboard,
// side-menu nav, and reports scope. It must be tenant-scoped and readable by
// ANY authenticated user (not just admins), unlike /admin/data-model.
describe('GET /tracks — tenant track set', () => {
  it('returns the tenant tracks with key/label, ordered', async () => {
    const r = await get('/tracks', ADMIN());
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    const keys = r.body.map((t) => t.key);
    expect(keys).toContain('sales');
    expect(keys).toContain('finance');
    for (const t of r.body) {
      expect(typeof t.key).toBe('string');
      expect(typeof t.label).toBe('string');
    }
  });

  it('is readable by a non-admin user (track set is not admin-gated)', async () => {
    const eva = token('u-eva', 'e.devries@group.eu', 'sales-mgr');
    const r = await get('/tracks', eva);
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
  });
});

// GET /features drives fleet-view gating (Vehicles/Timelines/Portal render only
// when the matching reference entity types exist) and the Settings → Workspace
// panel. Tenant-scoped, readable by any authenticated user.
describe('GET /features — tenant capabilities', () => {
  it('reports tenant facts + operational entity-type keys', async () => {
    const r = await get('/features', ADMIN());
    expect(r.status).toBe(200);
    expect(r.body.tenant).toBeTruthy();
    expect(typeof r.body.tenant.name).toBe('string');
    // The fleet demo has vehicle + fleet_operator reference types (bare keys).
    expect(r.body.referenceTypes).toContain('vehicle');
    expect(r.body.referenceTypes).toContain('fleet_operator');
    expect(Array.isArray(r.body.pipelineTypes)).toBe(true);
  });

  it('is readable by a non-admin user', async () => {
    const eva = token('u-eva', 'e.devries@group.eu', 'sales-mgr');
    const r = await get('/features', eva);
    expect(r.status).toBe(200);
    expect(r.body.referenceTypes).toContain('vehicle');
  });
});
