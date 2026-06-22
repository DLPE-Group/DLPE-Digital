import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';

export const rolesRouter: Router = Router();

rolesRouter.get('/roles', async (req, res) => {
  const roles = await withTenant(req.tenantId!, (db) => db.role.findMany({ orderBy: { id: 'asc' } }));
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
    const role = await withTenant(req.tenantId!, (db) => db.role.create({
      data: { id, name: d.name, desc: d.desc, tracks: d.tracks, edit: d.edit, system: d.system, users: 0, tenantId: req.tenantId! },
    }));
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
  const updated = await withTenant(req.tenantId!, async (db) => {
    const role = await db.role.findUnique({ where: { id: req.params.id } });
    if (!role) return null;
    return db.role.update({ where: { id: req.params.id }, data: parsed.data });
  });
  if (!updated) return res.status(404).json({ error: 'Role not found' });
  res.json(updated);
});

// DELETE /admin/roles/:id — remove a custom role (blocked for system roles or
// roles still assigned to any user, primary or secondary).
rolesRouter.delete('/roles/:id', async (req, res) => {
  const result = await withTenant(req.tenantId!, async (db) => {
    const role = await db.role.findUnique({ where: { id: req.params.id } });
    if (!role) return { notFound: true } as const;
    if (role.system) return { systemRole: true } as const;
    const [primary, secondary] = await Promise.all([
      db.user.count({ where: { roleId: req.params.id } }),
      db.userScope.count({ where: { roleId: req.params.id } }),
    ]);
    const inUse = primary + secondary;
    if (inUse > 0) return { inUse } as const;
    await db.fieldRule.deleteMany({ where: { roleId: req.params.id } });
    await db.role.delete({ where: { id: req.params.id } });
    return { ok: true } as const;
  });
  if ('notFound' in result) return res.status(404).json({ error: 'Role not found' });
  if ('systemRole' in result) return res.status(400).json({ error: 'System roles cannot be deleted.' });
  if ('inUse' in result) return res.status(400).json({ error: `Role is assigned to ${result.inUse} user(s) — reassign them first.` });
  res.json({ ok: true });
});

// POST /admin/roles/:id/clone — duplicate a role + all its field rules.
rolesRouter.post('/roles/:id/clone', async (req, res) => {
  const name = (typeof req.body?.name === 'string' && req.body.name.trim()) || undefined;
  const bodyId = (typeof req.body?.id === 'string' && req.body.id.trim()) || undefined;
  try {
    const result = await withTenant(req.tenantId!, async (db) => {
      const src = await db.role.findUnique({ where: { id: req.params.id } });
      if (!src) return null;
      const resolvedName = name || `${src.name} (copy)`;
      const newId = bodyId || slug(resolvedName);
      const role = await db.role.create({
        data: { id: newId, name: resolvedName, desc: src.desc, tracks: src.tracks, edit: 'custom', system: false, users: 0, tenantId: req.tenantId! },
      });
      const srcRules = await db.fieldRule.findMany({ where: { roleId: src.id } });
      if (srcRules.length) {
        await db.fieldRule.createMany({
          data: srcRules.map((r) => ({
            roleId: newId, dataTypeId: r.dataTypeId, fieldId: r.fieldId, scope: r.scope,
            visible: r.visible, editable: r.editable, masked: r.masked, note: r.note,
            tenantId: req.tenantId!,
          })),
        });
      }
      return { role, copiedRules: srcRules.length };
    });
    if (!result) return res.status(404).json({ error: 'Source role not found' });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
