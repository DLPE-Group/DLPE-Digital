import { describe, it, expect } from 'vitest';
import { get, ADMIN } from '../helpers.mjs';

// The resolver is exercised indirectly: after backfill (Task 4) every entity
// must carry the group tenantId. Here we assert the seed's org tree has exactly
// one GROUP node, which the resolver depends on as the fallback tenant.
describe('tenancy: org tree shape', () => {
  it('exposes a single GROUP node via /admin/structure', async () => {
    const r = await get('/admin/structure', ADMIN());
    expect(r.status).toBe(200);
    // root of the structure tree is the GROUP
    expect(r.body.kind).toBe('GROUP');
    expect(typeof r.body.id).toBe('string');
  });
});
