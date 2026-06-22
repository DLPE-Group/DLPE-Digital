import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';

export const triggersRouter: Router = Router();

triggersRouter.get('/triggers', async (req, res) => {
  const rows = await withTenant(req.tenantId!, (db) => db.crossTrigger.findMany({ orderBy: { id: 'asc' } }));
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
  const row = await withTenant(req.tenantId!, (db) => db.crossTrigger.create({ data: { ...parsed.data, tenantId: req.tenantId! } }));
  res.json(row);
});

triggersRouter.patch('/triggers/:id', async (req, res) => {
  const parsed = triggerSchema.partial().safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid trigger patch' });
  try {
    const row = await withTenant(req.tenantId!, (db) => db.crossTrigger.update({ where: { id: req.params.id }, data: parsed.data }));
    res.json(row);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

triggersRouter.delete('/triggers/:id', async (req, res) => {
  await withTenant(req.tenantId!, (db) => db.crossTrigger.delete({ where: { id: req.params.id } })).catch(() => undefined);
  res.json({ ok: true });
});
