import { describe, it, expect } from 'vitest';
import { get, post, ADMIN } from '../helpers.mjs';

describe('actions → cascade → audit revert', () => {
  it('signing Brussels cascades cross-track cards, then revert undoes it', async () => {
    const tok = ADMIN();
    const before = (await get('/cards?track=sales', tok)).body.length
      + (await get('/cards?track=operations', tok)).body.length
      + (await get('/cards?track=workshop', tok)).body.length
      + (await get('/cards?track=finance', tok)).body.length;

    const signed = await post('/cards/s5/actions/signContract', { state: {} }, tok);
    expect(signed.status).toBe(200);
    expect(signed.body.card.stageName).toMatch(/sign/i);
    expect(signed.body.createdCards.length).toBeGreaterThanOrEqual(2);

    const after = (await get('/cards?track=sales', tok)).body.length
      + (await get('/cards?track=operations', tok)).body.length
      + (await get('/cards?track=workshop', tok)).body.length
      + (await get('/cards?track=finance', tok)).body.length;
    expect(after).toBe(before + signed.body.createdCards.length);

    // find + revert the cascade audit entry
    const audit = await get('/audit', tok);
    const entry = audit.body.find(
      (a) => /contract signed/i.test(a.verb || '') && /brussels/i.test(a.target || ''),
    );
    expect(entry).toBeTruthy();
    const rev = await post(`/audit/${entry.id}/revert`, {}, tok);
    expect(rev.status).toBe(200);
    expect(rev.body.reverted).toBe(true);

    const restored = (await get('/cards?track=sales', tok)).body.length
      + (await get('/cards?track=operations', tok)).body.length
      + (await get('/cards?track=workshop', tok)).body.length
      + (await get('/cards?track=finance', tok)).body.length;
    expect(restored).toBe(before);
  });
});
