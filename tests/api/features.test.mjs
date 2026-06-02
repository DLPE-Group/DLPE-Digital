import { describe, it, expect } from 'vitest';
import { get, post, patch, ADMIN } from '../helpers.mjs';

describe('dashboard + reports', () => {
  const tok = ADMIN();

  it('dashboard snapshot is computed from real cards', async () => {
    const r = await get('/aggregations/dashboard', tok);
    expect(r.status).toBe(200);
    expect(typeof r.body.metrics.pipeline.value).toBe('number');
    expect(r.body.metrics.openByTrack.cats.length).toBe(4);
    expect(r.body.asOf).toBeTruthy();
  });

  it('generates a report (scripted fallback) and lists it', async () => {
    const r = await post('/reports', { title: 'QA Report', prompt: 'summary', period: 'Q2 2026', format: 'executive', scope: ['sales'] }, tok);
    expect(r.status).toBe(200);
    expect(r.body.id).toBeTruthy();
    expect(r.body.prose).toBeTruthy();
    const list = await get('/reports', tok);
    expect(list.body.some((x) => x.id === r.body.id)).toBe(true);
  });
});

describe('fleet + portal', () => {
  const tok = ADMIN();

  it('lists vehicles', async () => {
    const r = await get('/vehicles', tok);
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
  });

  it('returns the vehicle timeline with events', async () => {
    const r = await get('/vehicles/timeline', tok);
    expect(r.status).toBe(200);
    expect(r.body.events.length).toBeGreaterThan(0);
  });

  it('portal returns operator + vehicles + invoices, and persists a message', async () => {
    const p = await get('/portal', tok);
    expect(p.status).toBe(200);
    expect(p.body.vehicles.length).toBeGreaterThan(0);
    const m = await post('/portal/messages', { body: 'QA message', operator: p.body.operator }, tok);
    expect(m.status).toBe(200);
    const p2 = await get('/portal', tok);
    expect(p2.body.messages.length).toBeGreaterThan(0);
  });
});

describe('notifications, search, integrations', () => {
  const tok = ADMIN();

  it('derives notifications from live state', async () => {
    const r = await get('/notifications', tok);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it('searches cards + vehicles', async () => {
    const r = await get('/search?q=brussels', tok);
    expect(r.status).toBe(200);
    expect(r.body.results.some((x) => /brussels/i.test(x.label))).toBe(true);
  });

  it('tests + configures an integration', async () => {
    const list = await get('/integrations', tok);
    const id = list.body[0].id;
    const tested = await post(`/integrations/${id}/test`, {}, tok);
    expect(tested.status).toBe(200);
    expect(tested.body.ok).toBe(true);
    const cfg = await patch(`/integrations/${id}`, { desc: 'QA config' }, tok);
    expect(cfg.body.desc).toBe('QA config');
    const logs = await get(`/integrations/${id}/logs`, tok);
    expect(Array.isArray(logs.body.lines)).toBe(true);
  });
});
