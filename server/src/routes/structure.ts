import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { getTree, resolveSettingsFor, addCompany, updateNode } from '../domain/structure.service.js';

export const structureRouter: Router = Router();

structureRouter.get('/structure', async (_req, res) => {
  const tree = await getTree();
  if (!tree) return res.status(404).json({ error: 'No structure seeded' });
  res.json(tree);
});

structureRouter.get('/structure/:id/settings', async (req, res) => {
  res.json(await resolveSettingsFor(req.params.id));
});

const companySchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  meta: z.unknown().optional(),
  overrides: z.unknown().optional(),
});
structureRouter.post('/structure/:parentId/companies', async (req, res) => {
  const parsed = companySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'name required' });
  try {
    res.json(await addCompany(req.params.parentId, parsed.data));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

const patchSchema = z.object({
  name: z.string().optional(),
  meta: z.unknown().optional(),
  settings: z.unknown().optional(),
  overrides: z.unknown().optional(),
});
structureRouter.patch('/structure/:id', async (req, res) => {
  const parsed = patchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  try {
    res.json(await updateNode(req.params.id, parsed.data));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// ---- Data sharing ----
structureRouter.get('/data-sharing', async (_req, res) => {
  res.json(await prisma.dataSharing.findMany({ orderBy: { type: 'asc' } }));
});

const sharingSchema = z.object({
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
  const out = [];
  for (const row of parsed.data.rows) {
    out.push(
      await prisma.dataSharing.upsert({
        where: { type: row.type },
        update: { mode: row.mode, note: row.note },
        create: { type: row.type, mode: row.mode, note: row.note },
      }),
    );
  }
  res.json(out);
});
