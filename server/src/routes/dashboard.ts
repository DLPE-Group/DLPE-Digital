import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { DEFAULT_CHARTS } from '../domain/aggregations.js';

export const dashboardRouter: Router = Router();

// GET /me/dashboard — this user's saved charts, or the defaults.
dashboardRouter.get('/dashboard', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const layout = await prisma.dashboardLayout.findUnique({ where: { userId } });
  res.json({ charts: layout?.charts ?? DEFAULT_CHARTS });
});

export const putSchema = z.object({ charts: z.array(z.unknown()) });

// PUT /me/dashboard — upsert this user's charts.
dashboardRouter.put('/dashboard', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const parsed = putSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'charts array required' });
  const charts = parsed.data.charts as object;
  const layout = await prisma.dashboardLayout.upsert({
    where: { userId },
    update: { charts },
    create: { userId, charts, tenantId: req.tenantId! },
  });
  res.json({ charts: layout.charts });
});
