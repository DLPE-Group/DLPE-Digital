import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const rolesRouter: Router = Router();

rolesRouter.get('/roles', async (_req, res) => {
  const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } });
  res.json(roles);
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const createRoleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  desc: z.string().optional().default(''),
  tracks: z.array(z.string()).optional().default([]),
  edit: z.string().optional().default('custom'),
  system: z.boolean().optional().default(false),
});

// POST /admin/roles — create a new (non-system) role.
rolesRouter.post('/roles', async (req, res) => {
  const parsed = createRoleSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid role payload', detail: parsed.error.flatten() });
  const d = parsed.data;
  const id = d.id?.trim() || slug(d.name);
  if (!id) return res.status(400).json({ error: 'Could not derive a role id from the name' });
  try {
    const role = await prisma.role.create({
      data: { id, name: d.name, desc: d.desc, tracks: d.tracks, edit: d.edit, system: d.system, users: 0, tenantId: req.tenantId! },
    });
    res.json(role);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

const patchRoleSchema = z.object({
  name: z.string().min(1).optional(),
  desc: z.string().optional(),
  tracks: z.array(z.string()).optional(),
});
// PATCH /admin/roles/:id — rename / edit a role.
rolesRouter.patch('/roles/:id', async (req, res) => {
  const parsed = patchRoleSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid role payload' });
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) return res.status(404).json({ error: 'Role not found' });
  const updated = await prisma.role.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(updated);
});

// DELETE /admin/roles/:id — remove a custom role (blocked for system roles or
// roles still assigned to any user, primary or secondary).
rolesRouter.delete('/roles/:id', async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) return res.status(404).json({ error: 'Role not found' });
  if (role.system) return res.status(400).json({ error: 'System roles cannot be deleted.' });
  const [primary, secondary] = await Promise.all([
    prisma.user.count({ where: { roleId: req.params.id } }),
    prisma.userScope.count({ where: { roleId: req.params.id } }),
  ]);
  const inUse = primary + secondary;
  if (inUse > 0) return res.status(400).json({ error: `Role is assigned to ${inUse} user(s) — reassign them first.` });
  await prisma.$transaction([
    prisma.fieldRule.deleteMany({ where: { roleId: req.params.id } }),
    prisma.role.delete({ where: { id: req.params.id } }),
  ]);
  res.json({ ok: true });
});

// POST /admin/roles/:id/clone — duplicate a role + all its field rules.
rolesRouter.post('/roles/:id/clone', async (req, res) => {
  const src = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!src) return res.status(404).json({ error: 'Source role not found' });
  const name = (typeof req.body?.name === 'string' && req.body.name.trim()) || `${src.name} (copy)`;
  const newId = (typeof req.body?.id === 'string' && req.body.id.trim()) || slug(name);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { id: newId, name, desc: src.desc, tracks: src.tracks, edit: 'custom', system: false, users: 0, tenantId: req.tenantId! },
      });
      const srcRules = await tx.fieldRule.findMany({ where: { roleId: src.id } });
      if (srcRules.length) {
        await tx.fieldRule.createMany({
          data: srcRules.map((r) => ({
            roleId: newId, dataTypeId: r.dataTypeId, fieldId: r.fieldId, scope: r.scope,
            visible: r.visible, editable: r.editable, masked: r.masked, note: r.note,
            tenantId: req.tenantId!,
          })),
        });
      }
      return { role, copiedRules: srcRules.length };
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
