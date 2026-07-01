import { describe, it, expect } from 'vitest';
import { get, post, put, del, ADMIN } from '../helpers.mjs';

// Part A: a custom (non-builtin) track carries pipeline cards end-to-end through
// the data layer — author track → pipeline type → stages → card → visible via
// /cards, /tracks, and allowedTracks. Cleans up after itself so it doesn't
// change the demo tenant's track count for other tests.
describe('custom (non-builtin) track carries pipeline cards end-to-end', () => {
  it('author track → pipeline type → stages → card → visible, then clean up', async () => {
    const tok = ADMIN();

    // 1. Author a custom track (bare key, builtin=false).
    expect((await post('/admin/data-model/tracks', { key: 'legal', label: 'Legal', color: '#39c' }, tok)).status).toBe(200);
    // 2. A pipeline entity type on it.
    expect((await post('/admin/data-model/types', { key: 'matter', label: 'Matter', kind: 'pipeline', trackKey: 'legal' }, tok)).status).toBe(200);
    // 3. Its own stage set (StageConfig.track = 'legal').
    expect((await put('/admin/stage-config/legal', {
      stages: [
        { stageId: 'intake', label: 'Intake', sla: 5, cta: 'Open' },
        { stageId: 'closed', label: 'Closed', sla: 0, cta: 'Close' },
      ],
    }, tok)).status).toBe(200);

    // 4. A card in the custom track — stage resolves from the saved StageConfig.
    const created = await post('/cards', { track: 'legal', customer: 'Test Matter', value: 9000 }, tok);
    expect(created.status).toBe(200);
    expect(created.body.track).toBe('legal');
    expect(created.body.stageId).toBe('intake');

    // 5. Visible via the pipeline list, the track set, and allowedTracks.
    const list = await get('/cards?track=legal', tok);
    expect(list.body.some((c) => c.id === created.body.id)).toBe(true);
    expect((await get('/tracks', tok)).body.map((t) => t.key)).toContain('legal');
    expect((await get('/me/permissions', tok)).body.allowedTracks).toContain('legal');

    // cleanup (card → type → track) so the demo track count is restored.
    expect((await del(`/cards/${created.body.id}`, tok)).status).toBe(200);
    expect((await del('/admin/data-model/types/matter', tok)).status).toBe(200);
    expect((await del('/admin/data-model/tracks/legal', tok)).status).toBe(200);
  });
});
