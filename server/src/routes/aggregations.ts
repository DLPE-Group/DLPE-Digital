import { Router } from 'express';
import { computeTrack, dashboardSnapshot } from '../domain/aggregations.js';

export const aggregationsRouter: Router = Router();

aggregationsRouter.get('/track/:track', async (req, res) => {
  try {
    res.json(await computeTrack(req.params.track, req.user?.id));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

aggregationsRouter.get('/dashboard', async (req, res) => {
  res.json(await dashboardSnapshot(req.user?.id));
});
