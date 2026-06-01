import { describe, it, expect } from 'vitest';
import { req, get, token, ADMIN } from '../helpers.mjs';

const EVA = () => token('u-eva', 'e.devries@group.eu', 'sales-mgr');
const withPreview = (tok, asUserId) =>
  req('GET', '/aggregations/dashboard', { tok, headers: { 'x-preview-as': asUserId } });

// The dashboard/overview aggregations must apply the same track-access (H3) and
// row-level scope (H4) as the card lists — otherwise the overview shows track
// panels the user can't actually open.
describe('overview aggregations respect track access + scope', () => {
  it('admin overview shows all four tracks', async () => {
    const r = await get('/aggregations/dashboard', ADMIN());
    expect(r.status).toBe(200);
    const labels = r.body.metrics.openByTrack.cats.map((c) => c.label);
    expect(labels).toEqual(['Sales', 'Operations', 'Workshop', 'Finance']);
  });

  it('sales-mgr overview shows only the Sales track', async () => {
    const r = await get('/aggregations/dashboard', EVA());
    expect(r.status).toBe(200);
    const labels = r.body.metrics.openByTrack.cats.map((c) => c.label);
    expect(labels).toEqual(['Sales']);
  });

  it('computeTrack returns zeros for a track the caller cannot view', async () => {
    // Eva (sales-mgr) has no finance access → every finance metric is 0/€0.
    const r = await get('/aggregations/track/finance', EVA());
    expect(r.status).toBe(200);
    const receivables = r.body.metrics.find((m) => m.label === 'Receivables');
    expect(receivables.value).toBe('€0');
  });
});

// Preview-as: an admin can see the product exactly as another user via the
// x-preview-as header; non-admins cannot use it to escalate.
describe('preview-as (x-preview-as header)', () => {
  it('admin previewing as Eva sees only her tracks and rows', async () => {
    const perms = await req('GET', '/me/permissions', {
      tok: ADMIN(),
      headers: { 'x-preview-as': 'u-eva' },
    });
    expect(perms.status).toBe(200);
    expect(perms.body.allowedTracks).toEqual(['sales']);
    expect(perms.body.scopeType).toBe('company');

    const cards = await req('GET', '/cards', {
      tok: ADMIN(),
      headers: { 'x-preview-as': 'u-eva' },
    });
    expect(cards.body.every((c) => c.companyId === 'cmp-rotterdam')).toBe(true);

    const agg = await withPreview(ADMIN(), 'u-eva');
    expect(agg.body.metrics.openByTrack.cats.map((c) => c.label)).toEqual(['Sales']);
  });

  it('admin previewing changes nothing about their own un-previewed view', async () => {
    const r = await get('/cards', ADMIN());
    expect(r.body.length).toBeGreaterThan(1);
  });

  it('non-admin cannot escalate by sending x-preview-as', async () => {
    // Eva tries to preview as the group-admin — the header must be ignored.
    const perms = await req('GET', '/me/permissions', {
      tok: EVA(),
      headers: { 'x-preview-as': 'u-robert' },
    });
    expect(perms.status).toBe(200);
    expect(perms.body.allowedTracks).toEqual(['sales']);
  });
});
