import { Router } from 'express';
import { computeTrack, dashboardSnapshot } from '../domain/aggregations.js';
import { actingUserId } from '../auth/preview.js';
import { withTenant } from '../db/withTenant.js';

export const aggregationsRouter: Router = Router();

aggregationsRouter.get('/track/:track', async (req, res) => {
  try {
    res.json(await withTenant(req.tenantId!, (db) => computeTrack(req.params.track, actingUserId(req), db)));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

aggregationsRouter.get('/dashboard', async (req, res) => {
  res.json(await withTenant(req.tenantId!, (db) => dashboardSnapshot(actingUserId(req), db)));
});
