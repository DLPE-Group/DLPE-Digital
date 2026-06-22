import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';

// GET /admin/data-model — the data-driven meta-model (tracks + entity types +
// fields), plus no-code authoring (create/edit). Mounted under /api/admin, so
// it inherits requireAdmin (group-admin only).
export const dataModelRouter: Router = Router();

const KEY = z.string().regex(/^[a-z][a-z0-9_]*$/, 'key must be lowercase letters/digits/underscore');
const DATA_KINDS = ['text', 'money', 'date', 'select', 'number', 'bool'] as const;

async function nextOrder<T extends { order: number }>(rows: T[]): Promise<number> {
  return rows.reduce((m, r) => Math.max(m, r.order), -1) + 1;
}

dataModelRouter.get('/data-model', async (req, res) => {
  const [tracks, types] = await withTenant(req.tenantId!, async (db) => Promise.all([
    db.trackDef.findMany({
      orderBy: { order: 'asc' },
      include: { stages: { orderBy: { order: 'asc' } } },
    }),
    db.entityType.findMany({
      orderBy: { order: 'asc' },
      include: { fieldDefs: { orderBy: { order: 'asc' } }, track: true },
    }),
  ]));

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
  try {
    const row = await withTenant(req.tenantId!, async (db) => {
      if (await db.trackDef.findUnique({ where: { key: p.data.key } }))
        throw Object.assign(new Error(`Track "${p.data.key}" already exists`), { code: 409 });
      const order = await nextOrder(await db.trackDef.findMany());
      return db.trackDef.create({
        data: { key: p.data.key, label: p.data.label, color: p.data.color ?? null, order, builtin: false, tenantId: req.tenantId! },
      });
    });
    res.json({ key: row.key, label: row.label, color: row.color });
  } catch (e: any) {
    if (e.code === 409) return res.status(409).json({ error: e.message });
    res.status(400).json({ error: (e as Error).message });
  }
});

const TrackPatch = z.object({ label: z.string().min(1).optional(), color: z.string().optional() });
dataModelRouter.patch('/data-model/tracks/:key', async (req, res) => {
  const p = TrackPatch.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const result = await withTenant(req.tenantId!, async (db) => {
    const existing = await db.trackDef.findUnique({ where: { key: req.params.key } });
    if (!existing) return null;
    return db.trackDef.update({ where: { key: req.params.key }, data: p.data });
  });
  if (!result) return res.status(404).json({ error: 'Track not found' });
  res.json({ key: result.key, label: result.label, color: result.color });
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
  if (p.data.kind === 'pipeline' && !p.data.trackKey)
    return res.status(400).json({ error: 'A pipeline type needs a track' });
  try {
    const row = await withTenant(req.tenantId!, async (db) => {
      if (await db.entityType.findUnique({ where: { key: p.data.key } }))
        throw Object.assign(new Error(`Type "${p.data.key}" already exists`), { code: 409 });

      let trackId: string | null = null;
      if (p.data.kind === 'pipeline') {
        const track = await db.trackDef.findUnique({ where: { key: p.data.trackKey! } });
        if (!track) throw new Error(`Unknown track "${p.data.trackKey}"`);
        trackId = track.id;
      }
      const order = await nextOrder(await db.entityType.findMany());
      return db.entityType.create({
        data: { key: p.data.key, label: p.data.label, kind: p.data.kind, trackId, order, builtin: false, tenantId: req.tenantId! },
      });
    });
    res.json({ key: row.key, label: row.label, kind: row.kind });
  } catch (e: any) {
    if (e.code === 409) return res.status(409).json({ error: e.message });
    res.status(400).json({ error: (e as Error).message });
  }
});

const TypePatch = z.object({ label: z.string().min(1).optional(), color: z.string().optional(), icon: z.string().optional() });
dataModelRouter.patch('/data-model/types/:key', async (req, res) => {
  const p = TypePatch.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const result = await withTenant(req.tenantId!, async (db) => {
    const existing = await db.entityType.findUnique({ where: { key: req.params.key } });
    if (!existing) return null;
    return db.entityType.update({ where: { key: req.params.key }, data: p.data });
  });
  if (!result) return res.status(404).json({ error: 'Type not found' });
  res.json({ key: result.key, label: result.label });
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
  try {
    const row = await withTenant(req.tenantId!, async (db) => {
      const type = await db.entityType.findUnique({ where: { key: req.params.key }, include: { fieldDefs: true } });
      if (!type) throw Object.assign(new Error('Type not found'), { code: 404 });
      if (type.fieldDefs.some((f) => f.key === p.data.key))
        throw Object.assign(new Error(`Field "${p.data.key}" already exists on this type`), { code: 409 });
      const order = await nextOrder(type.fieldDefs);
      return db.fieldDef.create({
        data: { entityTypeId: type.id, key: p.data.key, label: p.data.label, category: p.data.category ?? null, dataKind: p.data.dataKind, order, builtin: false, tenantId: req.tenantId! },
      });
    });
    res.json({ key: row.key, label: row.label, category: row.category, dataKind: row.dataKind });
  } catch (e: any) {
    if (e.code === 404) return res.status(404).json({ error: e.message });
    if (e.code === 409) return res.status(409).json({ error: e.message });
    res.status(400).json({ error: (e as Error).message });
  }
});

const FieldPatch = z.object({
  label: z.string().min(1).optional(),
  category: z.string().optional(),
  dataKind: z.enum(DATA_KINDS).optional(),
});
dataModelRouter.patch('/data-model/types/:key/fields/:fieldKey', async (req, res) => {
  const p = FieldPatch.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const result = await withTenant(req.tenantId!, async (db) => {
    const type = await db.entityType.findUnique({ where: { key: req.params.key }, include: { fieldDefs: true } });
    if (!type) return { notFound: 'type' } as const;
    const field = type.fieldDefs.find((f) => f.key === req.params.fieldKey);
    if (!field) return { notFound: 'field' } as const;
    const row = await db.fieldDef.update({ where: { id: field.id }, data: p.data });
    return row;
  });
  if (typeof result === 'object' && 'notFound' in result) {
    return res.status(404).json({ error: result.notFound === 'type' ? 'Type not found' : 'Field not found' });
  }
  res.json({ key: (result as any).key, label: (result as any).label, category: (result as any).category, dataKind: (result as any).dataKind });
});

dataModelRouter.delete('/data-model/types/:key/fields/:fieldKey', async (req, res) => {
  const result = await withTenant(req.tenantId!, async (db) => {
    const type = await db.entityType.findUnique({ where: { key: req.params.key }, include: { fieldDefs: true } });
    if (!type) return { notFound: 'type' } as const;
    const field = type.fieldDefs.find((f) => f.key === req.params.fieldKey);
    if (!field) return { notFound: 'field' } as const;
    if (field.builtin) return { builtin: true } as const;
    await db.fieldDef.delete({ where: { id: field.id } });
    return { ok: true } as const;
  });
  if ('notFound' in result) {
    return res.status(404).json({ error: result.notFound === 'type' ? 'Type not found' : 'Field not found' });
  }
  if ('builtin' in result) return res.status(400).json({ error: 'Built-in fields cannot be deleted (they govern existing data).' });
  res.json({ ok: true });
});

// Delete an entity type (non-builtin, and only when no entities use it).
dataModelRouter.delete('/data-model/types/:key', async (req, res) => {
  const result = await withTenant(req.tenantId!, async (db) => {
    const type = await db.entityType.findUnique({ where: { key: req.params.key } });
    if (!type) return { notFound: true } as const;
    if (type.builtin) return { builtin: true } as const;
    const inUse = await db.entity.count({ where: { entityTypeId: type.id } });
    if (inUse > 0) return { inUse } as const;
    await db.entityType.delete({ where: { id: type.id } }); // cascades fieldDefs
    return { ok: true } as const;
  });
  if ('notFound' in result) return res.status(404).json({ error: 'Type not found' });
  if ('builtin' in result) return res.status(400).json({ error: 'Built-in types cannot be deleted.' });
  if ('inUse' in result) return res.status(400).json({ error: `Type has ${result.inUse} item(s) — delete or reassign them first.` });
  res.json({ ok: true });
});

// Delete a track (non-builtin, and only when no types/entities reference it).
dataModelRouter.delete('/data-model/tracks/:key', async (req, res) => {
  const result = await withTenant(req.tenantId!, async (db) => {
    const track = await db.trackDef.findUnique({ where: { key: req.params.key } });
    if (!track) return { notFound: true } as const;
    if (track.builtin) return { builtin: true } as const;
    const types = await db.entityType.count({ where: { trackId: track.id } });
    if (types > 0) return { types } as const;
    const ents = await db.entity.count({ where: { trackId: req.params.key } });
    if (ents > 0) return { ents } as const;
    await db.trackDef.delete({ where: { id: track.id } }); // cascades stageDefs
    return { ok: true } as const;
  });
  if ('notFound' in result) return res.status(404).json({ error: 'Track not found' });
  if ('builtin' in result) return res.status(400).json({ error: 'Built-in tracks cannot be deleted.' });
  if ('types' in result) return res.status(400).json({ error: `Track has ${result.types} entity type(s) — remove them first.` });
  if ('ents' in result) return res.status(400).json({ error: `Track has ${result.ents} item(s) — remove them first.` });
  res.json({ ok: true });
});
