import { describe, it, expect } from 'vitest';
import { get, token, ADMIN } from '../helpers.mjs';

// Row-level scope: a company-scoped user only sees their company's cards;
// a region-scoped user sees the region's companies but not other countries.
describe('row-level scope filtering', () => {
  it('Eva (company=cmp-rotterdam) only sees Rotterdam cards', async () => {
    const eva = token('u-eva', 'e.devries@group.eu', 'sales-mgr');
    const all = await get('/cards', eva);
    expect(all.status).toBe(200);
    expect(all.body.length).toBeGreaterThan(0);
    expect(all.body.every((c) => c.companyId === 'cmp-rotterdam')).toBe(true);
  });

  it('Tom (region=reg-benelux, ops) sees benelux ops but no DE companies', async () => {
    const tom = token('u-tom', 't@group.eu', 'ops-coord');
    const ops = await get('/cards?track=operations', tom);
    expect(ops.status).toBe(200);
    const companies = new Set(ops.body.map((c) => c.companyId));
    expect(companies.has('cmp-dusseldorf')).toBe(false);
    expect(companies.has('cmp-hamburg')).toBe(false);
  });

  it('group-admin sees all companies', async () => {
    const all = await get('/cards', ADMIN());
    const companies = new Set(all.body.map((c) => c.companyId));
    expect(companies.has('cmp-dusseldorf')).toBe(true);
    expect(companies.has('cmp-rotterdam')).toBe(true);
  });
});
