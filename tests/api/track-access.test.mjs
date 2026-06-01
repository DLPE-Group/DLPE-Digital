import { describe, it, expect } from 'vitest';
import { get, token, ADMIN } from '../helpers.mjs';

// Functional access: a role's `tracks` must gate which tracks a user sees.
describe('role → track access enforcement', () => {
  const eva = token('u-eva', 'e.devries@group.eu', 'sales-mgr'); // tracks: Sales, Dashboard

  it('sales-mgr sees sales cards but not operations/workshop/finance', async () => {
    expect((await get('/cards?track=sales', eva)).body.length).toBeGreaterThan(0);
    expect((await get('/cards?track=operations', eva)).body.length).toBe(0);
    expect((await get('/cards?track=workshop', eva)).body.length).toBe(0);
    expect((await get('/cards?track=finance', eva)).body.length).toBe(0);
  });

  it('group-admin sees every track', async () => {
    const tok = ADMIN();
    expect((await get('/cards?track=operations', tok)).body.length).toBeGreaterThan(0);
    expect((await get('/cards?track=finance', tok)).body.length).toBeGreaterThan(0);
  });

  it('/me/permissions reports allowedTracks', async () => {
    const r = await get('/me/permissions', eva);
    expect(r.body.allowedTracks).toContain('sales');
    expect(r.body.allowedTracks).not.toContain('finance');
  });
});
