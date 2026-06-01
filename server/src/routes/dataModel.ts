import { Router } from 'express';
import { prisma } from '../prisma.js';

// GET /admin/data-model — the data-driven meta-model (tracks + entity types +
// fields). Read-only first slice of the no-code "Data model" admin area.
// Mounted under /api/admin, so it inherits requireAdmin (group-admin only).
export const dataModelRouter: Router = Router();

dataModelRouter.get('/data-model', async (_req, res) => {
  const [tracks, types] = await Promise.all([
    prisma.trackDef.findMany({
      orderBy: { order: 'asc' },
      include: { stages: { orderBy: { order: 'asc' } } },
    }),
    prisma.entityType.findMany({
      orderBy: { order: 'asc' },
      include: { fieldDefs: { orderBy: { order: 'asc' } }, track: true },
    }),
  ]);

  res.json({
    tracks: tracks.map((t) => ({
      key: t.key,
      label: t.label,
      color: t.color,
      builtin: t.builtin,
      stages: t.stages.map((s) => ({ stageId: s.stageId, label: s.label, sla: s.sla, lock: s.lock, cta: s.cta })),
    })),
    types: types.map((e) => ({
      key: e.key,
      label: e.label,
      kind: e.kind,
      trackKey: e.track?.key ?? null,
      builtin: e.builtin,
      fields: e.fieldDefs.map((f) => ({ key: f.key, label: f.label, category: f.category, dataKind: f.dataKind })),
    })),
  });
});
