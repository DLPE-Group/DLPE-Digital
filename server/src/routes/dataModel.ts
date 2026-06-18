import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

// GET /admin/data-model — the data-driven meta-model (tracks + entity types +
// fields), plus no-code authoring (create/edit). Mounted under /api/admin, so
// it inherits requireAdmin (group-admin only).
export const dataModelRouter: Router = Router();

const KEY = z.string().regex(/^[a-z][a-z0-9_]*$/, 'key must be lowercase letters/digits/underscore');
const DATA_KINDS = ['text', 'money', 'date', 'select', 'number', 'bool'] as const;

async function nextOrder<T extends { order: number }>(rows: T[]): Promise<number> {
  return rows.reduce((m, r) => Math.max(m, r.order), -1) + 1;
}

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

// ---- Tracks ----
const TrackCreate = z.object({ key: KEY, label: z.string().min(1), color: z.string().optional() });
dataModelRouter.post('/data-model/tracks', async (req, res) => {
  const p = TrackCreate.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  if (await prisma.trackDef.findUnique({ where: { key: p.data.key } }))
    return res.status(409).json({ error: `Track "${p.data.key}" already exists` });
  const order = await nextOrder(await prisma.trackDef.findMany());
  const row = await prisma.trackDef.create({
    data: { key: p.data.key, label: p.data.label, color: p.data.color ?? null, order, builtin: false, tenantId: req.tenantId! },
  });
  res.json({ key: row.key, label: row.label, color: row.color });
});

const TrackPatch = z.object({ label: z.string().min(1).optional(), color: z.string().optional() });
dataModelRouter.patch('/data-model/tracks/:key', async (req, res) => {
  const p = TrackPatch.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const existing = await prisma.trackDef.findUnique({ where: { key: req.params.key } });
  if (!existing) return res.status(404).json({ error: 'Track not found' });
  const row = await prisma.trackDef.update({ where: { key: req.params.key }, data: p.data });
  res.json({ key: row.key, label: row.label, color: row.color });
});

// ---- Entity types ----
const TypeCreate = z.object({
  key: KEY,
  label: z.string().min(1),
  kind: z.enum(['pipeline', 'reference']),
  trackKey: z.string().optional(),
});
dataModelRouter.post('/data-model/types', async (req, res) => {
  const p = TypeCreate.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  if (await prisma.entityType.findUnique({ where: { key: p.data.key } }))
    return res.status(409).json({ error: `Type "${p.data.key}" already exists` });

  let trackId: string | null = null;
  if (p.data.kind === 'pipeline') {
    if (!p.data.trackKey) return res.status(400).json({ error: 'A pipeline type needs a track' });
    const track = await prisma.trackDef.findUnique({ where: { key: p.data.trackKey } });
    if (!track) return res.status(400).json({ error: `Unknown track "${p.data.trackKey}"` });
    trackId = track.id;
  }
  const order = await nextOrder(await prisma.entityType.findMany());
  const row = await prisma.entityType.create({
    data: { key: p.data.key, label: p.data.label, kind: p.data.kind, trackId, order, builtin: false, tenantId: req.tenantId! },
  });
  res.json({ key: row.key, label: row.label, kind: row.kind });
});

const TypePatch = z.object({ label: z.string().min(1).optional(), color: z.string().optional(), icon: z.string().optional() });
dataModelRouter.patch('/data-model/types/:key', async (req, res) => {
  const p = TypePatch.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const existing = await prisma.entityType.findUnique({ where: { key: req.params.key } });
  if (!existing) return res.status(404).json({ error: 'Type not found' });
  const row = await prisma.entityType.update({ where: { key: req.params.key }, data: p.data });
  res.json({ key: row.key, label: row.label });
});

// ---- Fields ----
const FieldCreate = z.object({
  key: KEY,
  label: z.string().min(1),
  category: z.string().optional(),
  dataKind: z.enum(DATA_KINDS).default('text'),
});
dataModelRouter.post('/data-model/types/:key/fields', async (req, res) => {
  const p = FieldCreate.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const type = await prisma.entityType.findUnique({ where: { key: req.params.key }, include: { fieldDefs: true } });
  if (!type) return res.status(404).json({ error: 'Type not found' });
  if (type.fieldDefs.some((f) => f.key === p.data.key))
    return res.status(409).json({ error: `Field "${p.data.key}" already exists on this type` });
  const order = await nextOrder(type.fieldDefs);
  const row = await prisma.fieldDef.create({
    data: { entityTypeId: type.id, key: p.data.key, label: p.data.label, category: p.data.category ?? null, dataKind: p.data.dataKind, order, builtin: false, tenantId: req.tenantId! },
  });
  res.json({ key: row.key, label: row.label, category: row.category, dataKind: row.dataKind });
});

const FieldPatch = z.object({
  label: z.string().min(1).optional(),
  category: z.string().optional(),
  dataKind: z.enum(DATA_KINDS).optional(),
});
dataModelRouter.patch('/data-model/types/:key/fields/:fieldKey', async (req, res) => {
  const p = FieldPatch.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const type = await prisma.entityType.findUnique({ where: { key: req.params.key }, include: { fieldDefs: true } });
  if (!type) return res.status(404).json({ error: 'Type not found' });
  const field = type.fieldDefs.find((f) => f.key === req.params.fieldKey);
  if (!field) return res.status(404).json({ error: 'Field not found' });
  const row = await prisma.fieldDef.update({ where: { id: field.id }, data: p.data });
  res.json({ key: row.key, label: row.label, category: row.category, dataKind: row.dataKind });
});

dataModelRouter.delete('/data-model/types/:key/fields/:fieldKey', async (req, res) => {
  const type = await prisma.entityType.findUnique({ where: { key: req.params.key }, include: { fieldDefs: true } });
  if (!type) return res.status(404).json({ error: 'Type not found' });
  const field = type.fieldDefs.find((f) => f.key === req.params.fieldKey);
  if (!field) return res.status(404).json({ error: 'Field not found' });
  if (field.builtin) return res.status(400).json({ error: 'Built-in fields cannot be deleted (they govern existing data).' });
  await prisma.fieldDef.delete({ where: { id: field.id } });
  res.json({ ok: true });
});

// Delete an entity type (non-builtin, and only when no entities use it).
dataModelRouter.delete('/data-model/types/:key', async (req, res) => {
  const type = await prisma.entityType.findUnique({ where: { key: req.params.key } });
  if (!type) return res.status(404).json({ error: 'Type not found' });
  if (type.builtin) return res.status(400).json({ error: 'Built-in types cannot be deleted.' });
  const inUse = await prisma.entity.count({ where: { entityTypeId: type.id } });
  if (inUse > 0) return res.status(400).json({ error: `Type has ${inUse} item(s) — delete or reassign them first.` });
  await prisma.entityType.delete({ where: { id: type.id } }); // cascades fieldDefs
  res.json({ ok: true });
});

// Delete a track (non-builtin, and only when no types/entities reference it).
dataModelRouter.delete('/data-model/tracks/:key', async (req, res) => {
  const track = await prisma.trackDef.findUnique({ where: { key: req.params.key } });
  if (!track) return res.status(404).json({ error: 'Track not found' });
  if (track.builtin) return res.status(400).json({ error: 'Built-in tracks cannot be deleted.' });
  const types = await prisma.entityType.count({ where: { trackId: track.id } });
  if (types > 0) return res.status(400).json({ error: `Track has ${types} entity type(s) — remove them first.` });
  const ents = await prisma.entity.count({ where: { trackId: req.params.key } });
  if (ents > 0) return res.status(400).json({ error: `Track has ${ents} item(s) — remove them first.` });
  await prisma.trackDef.delete({ where: { id: track.id } }); // cascades stageDefs
  res.json({ ok: true });
});
