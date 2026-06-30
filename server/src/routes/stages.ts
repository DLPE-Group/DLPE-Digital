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
