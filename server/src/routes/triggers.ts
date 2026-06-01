import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const triggersRouter: Router = Router();

triggersRouter.get('/triggers', async (_req, res) => {
  const rows = await prisma.crossTrigger.findMany({ orderBy: { id: 'asc' } });
  res.json(rows);
});

const triggerSchema = z.object({
  whenTrack: z.string().min(1),
  whenStage: z.string().min(1),
  thenTrack: z.string().min(1),
  thenStage: z.string().min(1),
  note: z.string().default(''),
});

triggersRouter.post('/triggers', async (req, res) => {
  const parsed = triggerSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid trigger payload' });
  const row = await prisma.crossTrigger.create({ data: parsed.data });
  res.json(row);
});

triggersRouter.delete('/triggers/:id', async (req, res) => {
  await prisma.crossTrigger.delete({ where: { id: req.params.id } }).catch(() => undefined);
  res.json({ ok: true });
});
