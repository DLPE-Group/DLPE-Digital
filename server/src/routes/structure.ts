import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { getTree, resolveSettingsFor, addCompany, updateNode, addNode, deleteNode } from '../domain/structure.service.js';

export const structureRouter: Router = Router();

structureRouter.get('/structure', async (req, res) => {
  const tree = await withTenant(req.tenantId!, (db) => getTree(db));
  if (!tree) return res.status(404).json({ error: 'No structure seeded' });
  res.json(tree);
});

structureRouter.get('/structure/:id/settings', async (req, res) => {
  const settings = await withTenant(req.tenantId!, (db) => resolveSettingsFor(req.params.id, db));
  res.json(settings);
});

export const companySchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  meta: z.unknown().optional(),
  overrides: z.unknown().optional(),
});
structureRouter.post('/structure/:parentId/companies', async (req, res) => {
  const parsed = companySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'name required' });
  try {
    const node = await withTenant(req.tenantId!, (db) => addCompany(req.params.parentId, parsed.data, req.tenantId!, db));
    res.json(node);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Add a child node (region / country / company) under a parent.
export const nodeSchema = z.object({
  kind: z.enum(['REGION', 'COUNTRY', 'COMPANY']),
  name: z.string().min(1),
  code: z.string().optional(),
});
structureRouter.post('/structure/:parentId/nodes', async (req, res) => {
  const parsed = nodeSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'kind + name required' });
  try {
    const node = await withTenant(req.tenantId!, (db) => addNode(req.params.parentId, parsed.data, req.tenantId!, db));
    res.json(node);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

structureRouter.delete('/structure/:id', async (req, res) => {
  try {
    await withTenant(req.tenantId!, (db) => deleteNode(req.params.id, db));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

export const patchSchema = z.object({
  name: z.string().optional(),
  meta: z.unknown().optional(),
  settings: z.unknown().optional(),
  overrides: z.unknown().optional(),
});
structureRouter.patch('/structure/:id', async (req, res) => {
  const parsed = patchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  try {
    const node = await withTenant(req.tenantId!, (db) => updateNode(req.params.id, parsed.data, db));
    res.json(node);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// ---- Data sharing ----
structureRouter.get('/data-sharing', async (req, res) => {
  const rows = await withTenant(req.tenantId!, (db) => db.dataSharing.findMany({ orderBy: { type: 'asc' } }));
  res.json(rows);
});

export const sharingSchema = z.object({
  rows: z.array(
    z.object({
      type: z.string().min(1),
      mode: z.enum(['shared', 'private', 'group']),
      note: z.string().default(''),
    }),
  ),
});
structureRouter.put('/data-sharing', async (req, res) => {
  const parsed = sharingSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid data-sharing payload' });
  const out = await withTenant(req.tenantId!, async (db) => {
    const results = [];
    for (const row of parsed.data.rows) {
      results.push(
        await db.dataSharing.upsert({
          where: { type: row.type },
          update: { mode: row.mode, note: row.note },
          create: { type: row.type, mode: row.mode, note: row.note, tenantId: req.tenantId! },
        }),
      );
    }
    return results;
  });
  res.json(out);
});
