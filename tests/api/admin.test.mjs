import { describe, it, expect } from 'vitest';
import { get, post, put, patch, del, ADMIN } from '../helpers.mjs';

describe('admin — structure / users / config / preferences', () => {
  const tok = ADMIN();

  it('renames an org node + sets an override (persists)', async () => {
    const r = await patch('/admin/structure/co-nl', { name: 'NL (test)', overrides: { vat: '21% (test)' } }, tok);
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('NL (test)');
  });

  it('adds and removes a secondary scope', async () => {
    const add = await post('/admin/users/u-eva/scopes', { scopeType: 'company', scopeLabel: 'Belgium', roleLabel: 'Sales rep', roleId: 'sales-rep' }, tok);
    expect(add.status).toBe(200);
    expect(add.body.id).toBeTruthy();
    const rm = await del(`/admin/users/u-eva/scopes/${add.body.id}`, tok);
    expect(rm.status).toBe(200);
  });

  it('persists user preferences (merge)', async () => {
    const r = await put('/me/preferences', { slackNotif: true, dailyDigest: false }, tok);
    expect(r.status).toBe(200);
    expect(r.body.slackNotif).toBe(true);
    const g = await get('/me/preferences', tok);
    expect(g.body.slackNotif).toBe(true);
    expect(g.body.dailyDigest).toBe(false);
  });

  it('bulk-imports users from CSV', async () => {
    const csv = 'name,email,roleId\nQA One,qa.one@group.eu,sales-rep\nQA Two,qa.two@group.eu,ops-coord';
    const r = await post('/admin/users/import', { csv }, tok);
    expect(r.status).toBe(200);
    expect(r.body.created).toBe(2);
    expect(r.body.errors.length).toBe(0);
  });

  it('saves a cross-track trigger', async () => {
    const r = await post('/admin/triggers', { whenTrack: 'sales', whenStage: 'Signed', thenTrack: 'finance', thenStage: 'Invoice to create', note: 'test' }, tok);
    expect(r.status).toBe(200);
  });
});
