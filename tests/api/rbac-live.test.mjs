import { describe, it, expect } from 'vitest';
import { get, put, token, ADMIN } from '../helpers.mjs';

// Eva de Vries (u-eva) is a sales-mgr. Hiding the contract value for her role
// must remove it from the LIVE pipeline data she sees — not just the /records
// preview. This is the bug the user reported.
describe('RBAC field rules apply to live data (not just preview)', () => {
  const eva = token('u-eva', 'e.devries@group.eu', 'sales-mgr');

  it('hiding contract_value for the role strips card.value from that user', async () => {
    // baseline: Eva sees the value
    const before = await get('/cards?track=sales', eva);
    expect(before.status).toBe(200);
    expect(before.body[0].value).toBeGreaterThan(0);

    // admin hides contract_value for sales-mgr
    const saved = await put('/admin/field-rules', {
      diffs: [{ roleId: 'sales-mgr', dataTypeId: 'contract', fieldId: 'contract_value', scope: 'ANY', visible: false, editable: false, masked: false }],
      actor: 'test',
    }, ADMIN());
    expect(saved.status).toBe(200);

    // Eva should no longer receive the value on live cards
    const after = await get('/cards?track=sales', eva);
    expect(after.status).toBe(200);
    expect(after.body[0].value == null).toBe(true);

    // admin (no restricting rule) still sees it
    const adminView = await get('/cards?track=sales', ADMIN());
    expect(adminView.body[0].value).toBeGreaterThan(0);
  });
});
