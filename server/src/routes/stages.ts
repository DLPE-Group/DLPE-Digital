import { Router } from 'express';
import { TRACK_KEY_FROM_ENUM } from '@dlpe/shared';
import { withTenant } from '../db/withTenant.js';

export const stagesRouter: Router = Router();

// Recover the *operational* key from a (possibly prefixed) registry key.
// TrackDef.key / EntityType.key are globally unique, so the provisioner
// namespaces builtin rows as `<slug>-<key>`. The rest of the runtime (and the
// UI) keys on the bare operational key, so strip the tenant `<slug>-` prefix
// from builtin rows. Authored (builtin=false) rows are already bare.
const operationalKey = (key: string, builtin: boolean, pfx: string): string =>
  builtin && pfx && key.startsWith(pfx) ? key.slice(pfx.length) : key;

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
  res.json(rows.map((t) => ({
    key: operationalKey(t.key, t.builtin, pfx),
    label: t.label,
    color: t.color,
    builtin: t.builtin,
  })));
});

// GET /api/features — tenant-level capabilities for the UI, readable by ANY
// authenticated user. Drives (a) fleet-view gating — the Vehicles/Timelines and
// Customer-portal nav + views render only when the tenant's data model actually
// has the matching reference entity types ('vehicle', 'fleet_operator'); and
// (b) the Settings → Workspace panel, which shows the tenant's REAL name/region
// instead of hardcoded copy. Entity-type keys are returned as operational
// (prefix-stripped) keys, consistent with /tracks.
stagesRouter.get('/features', async (req, res) => {
  const { tenant, types } = await withTenant(req.tenantId!, async (db) => {
    const t = await db.tenant.findUnique({ where: { id: req.tenantId! } });
    const et = await db.entityType.findMany({ orderBy: { order: 'asc' } });
    return { tenant: t, types: et };
  });
  const pfx = tenant?.slug ? `${tenant.slug}-` : '';
  const keysOf = (kindMatch: (k: string) => boolean) =>
    types.filter((t) => kindMatch(t.kind)).map((t) => operationalKey(t.key, t.builtin, pfx));
  res.json({
    tenant: tenant ? { name: tenant.name, region: tenant.region, slug: tenant.slug } : null,
    referenceTypes: keysOf((k) => k !== 'pipeline'),
    pipelineTypes: keysOf((k) => k === 'pipeline'),
  });
});
