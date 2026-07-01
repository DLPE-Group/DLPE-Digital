import { describe, it, expect } from 'vitest';
import { get, put, ADMIN } from '../helpers.mjs';

describe('cards + stage locks', () => {
  it('lists seeded sales cards', async () => {
    const r = await get('/cards?track=sales', ADMIN());
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBe(5);
  });

  it('gets a single card', async () => {
    const r = await get('/cards/s1', ADMIN());
    expect(r.status).toBe(200);
    expect(r.body.id).toBe('s1');
  });

  it('blocks a forward skip past a locked stage, allows a one-step move', async () => {
    const tok = ADMIN();
    const cfg = await get('/admin/stage-config', tok);
    const sales = (Array.isArray(cfg.body) ? cfg.body : [])
      .filter((s) => String(s.track).toUpperCase() === 'SALES')
      .sort((a, b) => a.order - b.order);
    expect(sales.length).toBeGreaterThan(3);

    const card = (await get('/cards/s1', tok)).body;
    const curIdx = sales.findIndex((s) => s.stageId === card.stageId);

    // a target ≥2 ahead whose lock prerequisite hasn't been reached → blocked
    const skipTarget = sales[curIdx + 2];
    if (skipTarget) {
      const blocked = await put('/cards/s1/stage', { stageId: skipTarget.stageId }, tok);
      expect(blocked.status).toBe(400);
      expect(String(blocked.body.error)).toMatch(/lock/i);
    }

    // one step forward → allowed
    const next = sales[curIdx + 1];
    if (next) {
      const ok = await put('/cards/s1/stage', { stageId: next.stageId }, tok);
      expect(ok.status).toBe(200);
      expect(ok.body.card.stageId).toBe(next.stageId); // move response is { card, createdCards, cascades }
    }
  });
});
