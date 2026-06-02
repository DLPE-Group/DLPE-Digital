import { describe, it, expect } from 'vitest';
import { get, put, ADMIN } from '../helpers.mjs';

// Editing stage config in the DB must drive runtime behaviour (moveStage label),
// not the static shared config.
describe('stage config is DB-driven at runtime', () => {
  it('editing a stage label changes the stageName written on a move', async () => {
    const tok = ADMIN();
    const cfg = await get('/admin/stage-config', tok);
    const sales = (Array.isArray(cfg.body) ? cfg.body : [])
      .filter((s) => String(s.track).toUpperCase() === 'SALES')
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ stageId: s.stageId, label: s.label, sla: s.sla, lock: s.lock, cta: s.cta }));

    const target = sales.find((s) => s.stageId === 'offer');
    target.label = 'Offer (edited)';

    const saved = await put('/admin/stage-config/sales', { stages: sales }, tok);
    expect(saved.status).toBe(200);

    // move s1 (currently lead/meeting) one step is lock-guarded; move s2 (contract) back to offer is allowed (backwards)
    const moved = await put('/cards/s2/stage', { stageId: 'offer' }, tok);
    expect(moved.status).toBe(200);
    expect(moved.body.stageName).toBe('Offer (edited)');
  });
});
