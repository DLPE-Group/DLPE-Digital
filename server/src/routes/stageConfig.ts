import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withTenant } from '../db/withTenant.js';

export const stageConfigRouter: Router = Router();

// GET /admin/stage-config?track=  — track is the operational key (bare, e.g.
// 'sales' or a custom 'insurance').
stageConfigRouter.get('/stage-config', async (req, res) => {
  const where: { track?: string } = {};
  if (typeof req.query.track === 'string') where.track = req.query.track.toLowerCase();
  const rows = await withTenant(req.tenantId!, (db) => db.stageConfig.findMany({ where, orderBy: [{ track: 'asc' }, { order: 'asc' }] }));
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
  // Operational track key (bare). Any track with a pipeline type may have stages
  // — builtin or custom — so there is no enum to validate against.
  const track = req.params.track.toLowerCase();
  const parsed = putSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid stage-config payload' });

  // Reject duplicate stageIds in the payload up front (would violate the
  // per-tenant unique mid-transaction and is a user error worth naming).
  const ids = parsed.data.stages.map((s) => s.stageId);
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'Duplicate stageId in payload — each stage id must be unique within a track' });
  }

  try {
    const result = await withTenant(req.tenantId!, async (db) => {
      // Guard: don't delete a stage that still has records in it — that would
      // orphan them. Diff the incoming set against the persisted one and, for
      // any removed stage, count records currently sitting there.
      const existing = await db.stageConfig.findMany({ where: { track }, select: { stageId: true } });
      const keep = new Set(ids);
      const removed = existing.map((e) => e.stageId).filter((id) => !keep.has(id));
      if (removed.length > 0) {
        const counts = await db.entity.groupBy({
          by: ['stageId'],
          where: { stageId: { in: removed } },
          _count: { _all: true },
        });
        const blocking = counts
          .filter((c) => c._count._all > 0)
          .map((c) => ({ stageId: c.stageId, count: c._count._all }));
        if (blocking.length > 0) return { kind: 'conflict' as const, blocking };
      }

      await db.stageConfig.deleteMany({ where: { track } });
      const created = [];
      for (let i = 0; i < parsed.data.stages.length; i++) {
        const s = parsed.data.stages[i];
        created.push(
          await db.stageConfig.create({
            data: { track, order: i, stageId: s.stageId, label: s.label, sla: s.sla, lock: s.lock ?? null, cta: s.cta, tenantId: req.tenantId! },
          }),
        );
      }
      return { kind: 'ok' as const, created };
    });

    if (result.kind === 'conflict') {
      const names = result.blocking.map((b) => `${b.stageId} (${b.count})`).join(', ');
      return res.status(409).json({
        error: `Can't remove a stage that still has records: ${names}. Move those records to another stage first.`,
        stages: result.blocking,
      });
    }
    res.json(result.created);
  } catch (e) {
    // Never let a DB error escape the handler — an unhandled rejection here
    // would crash the API process. Map the known conflict, 500 otherwise.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return res.status(409).json({ error: 'A stage with that id already exists for this track' });
    }
    console.error('stage-config PUT failed', e);
    return res.status(500).json({ error: 'Failed to save stage configuration' });
  }
});
