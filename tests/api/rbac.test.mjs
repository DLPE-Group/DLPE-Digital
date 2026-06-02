import { describe, it, expect } from 'vitest';
import { get, post, put, ADMIN } from '../helpers.mjs';

describe('RBAC — field filtering', () => {
  it('admin sees full contract; sales-rep loses bank account + margin', async () => {
    const tok = ADMIN();
    const full = await get('/records/contract', tok);
    expect(full.status).toBe(200);
    expect(full.body.record.bank_account).toBeTruthy();

    const rep = await get('/records/contract?role=sales-rep', tok);
    expect(rep.status).toBe(200);
    expect(rep.body.record.bank_account).toBeUndefined();
    expect(rep.body.record.margin).toBeUndefined();

    const ops = await get('/records/contract?role=ops-coord', tok);
    expect(ops.body.record.contract_value).toMatch(/X/); // masked €XXX,XXX
  });
});

describe('RBAC — roles + version revert', () => {
  it('creates, clones, then reverts a field-rule version', async () => {
    const tok = ADMIN();

    const created = await post('/admin/roles', { name: 'QA Auditor', desc: 'test', tracks: ['sales'] }, tok);
    expect(created.status).toBe(200);
    expect(created.body.system).toBe(false);

    const cloned = await post('/admin/roles/sales-rep/clone', {}, tok);
    expect(cloned.status).toBe(200);
    expect(cloned.body.copiedRules).toBeGreaterThan(0);

    // save a field-rule change → snapshotted version
    const saved = await put('/admin/field-rules', {
      diffs: [{ roleId: 'sales-rep', dataTypeId: 'contract', fieldId: 'margin', scope: 'ANY', visible: false, editable: false, masked: false }],
      actor: 'QA',
    }, tok);
    expect(saved.status).toBe(200);
    expect(saved.body.version.snapshot).toBeTruthy();

    const versions = await get('/admin/rbac/versions', tok);
    const latest = versions.body[0].v;
    const rev = await post(`/admin/rbac/versions/${latest}/revert`, {}, tok);
    expect(rev.status).toBe(200);
    expect(rev.body.restored).toBeGreaterThan(0);
  });
});
