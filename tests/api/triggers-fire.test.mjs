import { describe, it, expect } from 'vitest';
import { get, post, put, del, ADMIN } from '../helpers.mjs';

// Cross-track triggers must FIRE generically on a stage change: authoring a
// trigger and then moving a card into its `whenStage` creates a card in
// `thenTrack` at `thenStage` — without the old hardcoded per-cascade engine.
// Uses a self-created card so no shared fixture card is mutated (the suite
// shares one DB across files).
describe('cross-track triggers fire on stage change', () => {
  it('moving a card into a trigger\'s whenStage cascades a card into thenTrack', async () => {
    const tok = ADMIN();
    const stages = (await get('/stages', tok)).body;
    const salesStages = stages.sales || [];
    const opsStages = stages.operations || [];
    expect(salesStages.length).toBeGreaterThan(0);
    expect(opsStages.length).toBeGreaterThan(0);
    const whenStage = salesStages[0].label; // first stage — re-entering it is always allowed
    const thenStage = opsStages[0].label;

    // A fresh sales card (lands in the first stage) — nothing else depends on it.
    const src = await post('/cards', { track: 'sales', customer: 'Trigger Source Co', value: 1000 }, tok);
    expect(src.status).toBe(200);

    // Author a trigger: sales/<first stage> → operations/<first stage>.
    const trig = await post('/admin/triggers',
      { whenTrack: 'sales', whenStage, thenTrack: 'operations', thenStage, note: 'QA cascade' }, tok);
    expect(trig.status).toBe(200);

    // Move the source card into the whenStage → expect a cascaded operations card.
    const moved = await put(`/cards/${src.body.id}/stage`, { stageId: salesStages[0].id }, tok);
    expect(moved.status).toBe(200);
    expect(moved.body.card.stageName).toBe(whenStage);
    const cascaded = (moved.body.createdCards || []).find((c) => c.track === 'operations');
    expect(cascaded).toBeTruthy();
    expect(cascaded.stageName).toBe(thenStage);
    expect(cascaded.customer).toBe('Trigger Source Co');

    // cleanup: remove the cascaded card, the source card, and the trigger.
    await del(`/cards/${cascaded.id}`, tok);
    await del(`/cards/${src.body.id}`, tok);
    if (trig.body.id) await del(`/admin/triggers/${trig.body.id}`, tok);
  });
});
