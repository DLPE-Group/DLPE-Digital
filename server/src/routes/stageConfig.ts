import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { trackKeyToEnum } from '../domain/cards.service.js';

export const stageConfigRouter: Router = Router();

// GET /admin/stage-config?track=
stageConfigRouter.get('/stage-config', async (req, res) => {
  const where: { track?: ReturnType<typeof trackKeyToEnum> } = {};
  if (typeof req.query.track === 'string') {
    try {
      where.track = trackKeyToEnum(req.query.track);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
  }
  const rows = await prisma.stageConfig.findMany({ where, orderBy: [{ track: 'asc' }, { order: 'asc' }] });
  res.json(rows);
});

const stageSchema = z.object({
  stageId: z.string().min(1),
  label: z.string().min(1),
  sla: z.number().int().default(0),
  lock: z.string().nullable().optional(),
  cta: z.string().default(''),
});
const putSchema = z.object({ stages: z.array(stageSchema).min(1) });

// PUT /admin/stage-config/:track — replace the ordered stage set for a track.
stageConfigRouter.put('/stage-config/:track', async (req, res) => {
  let trackEnum: ReturnType<typeof trackKeyToEnum>;
  try {
    trackEnum = trackKeyToEnum(req.params.track);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
  const parsed = putSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid stage-config payload' });

  const rows = await prisma.$transaction(async (tx) => {
    await tx.stageConfig.deleteMany({ where: { track: trackEnum } });
    const created = [];
    for (let i = 0; i < parsed.data.stages.length; i++) {
      const s = parsed.data.stages[i];
      created.push(
        await tx.stageConfig.create({
          data: { track: trackEnum, order: i, stageId: s.stageId, label: s.label, sla: s.sla, lock: s.lock ?? null, cta: s.cta },
        }),
      );
    }
    return created;
  });

  res.json(rows);
});
