import { Router } from 'express';
import { TRACK_KEY_FROM_ENUM } from '@dlpe/shared';
import { withTenant } from '../db/withTenant.js';

export const stagesRouter: Router = Router();

// GET /api/stages — the tenant's saved stage configuration, grouped by track key.
// Tenant-scoped, readable by ANY authenticated user (the dashboard board renders
// it for everyone), unlike the admin-only editor endpoint /admin/stage-config.
// This is what makes saved stage edits actually show up on the board.
stagesRouter.get('/stages', async (req, res) => {
  const rows = await withTenant(req.tenantId!, (db) =>
    db.stageConfig.findMany({ orderBy: [{ track: 'asc' }, { order: 'asc' }] }),
  );
  const byTrack: Record<string, Array<{ id: string; label: string; sla: number; lock: string | null; cta: string; order: number }>> = {};
  for (const r of rows) {
    const key = TRACK_KEY_FROM_ENUM[r.track] ?? String(r.track).toLowerCase();
    (byTrack[key] ||= []).push({ id: r.stageId, label: r.label, sla: r.sla, lock: r.lock ?? null, cta: r.cta, order: r.order });
  }
  res.json(byTrack);
});

// GET /api/tracks — the tenant's tracks (data-model driven), ordered. Readable
// by ANY authenticated user, unlike the admin-only /admin/data-model. This is
// the single source of truth for the dashboard track set, the side-menu track
// nav, and the reports scope — so the UI renders exactly the tracks the tenant
// has configured and never a hardcoded/stale set (e.g. an empty tenant shows
// no tracks at all).
//
// IMPORTANT — the key we return is the *operational* track key, which is what
// the rest of the runtime is keyed on: Entity.trackId, StageConfig (/stages),
// /cards?track=, and /me/permissions.allowedTracks all use the bare key
// ('sales'). TrackDef.key, however, is GLOBALLY unique, so the provisioner
// namespaces builtin tracks as `<slug>-<key>` ('gamma-co-sales') to avoid
// cross-tenant clashes. We therefore strip the tenant's `<slug>-` prefix from
// builtin tracks to recover the operational key. Authored custom tracks
// (builtin = false) are created with bare keys already, so they pass through.
stagesRouter.get('/tracks', async (req, res) => {
  const { slug, rows } = await withTenant(req.tenantId!, async (db) => {
    const tenant = await db.tenant.findUnique({ where: { id: req.tenantId! } });
    const trackRows = await db.trackDef.findMany({ orderBy: { order: 'asc' } });
    return { slug: tenant?.slug ?? '', rows: trackRows };
  });
  const pfx = slug ? `${slug}-` : '';
  res.json(rows.map((t) => {
    const key = t.builtin && pfx && t.key.startsWith(pfx) ? t.key.slice(pfx.length) : t.key;
    return { key, label: t.label, color: t.color, builtin: t.builtin };
  }));
});
