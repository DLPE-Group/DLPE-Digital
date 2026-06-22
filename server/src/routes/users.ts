import { Router } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import { prisma } from '../prisma.js';
import { loadEntitlements } from '../domain/billing/entitlements.js';
import { withTenant } from '../db/withTenant.js';

export const usersRouter: Router = Router();

const userInclude = { role: true, scopeNode: true, secondary: { include: { role: true, scopeNode: true } } } as const;

usersRouter.get('/users', async (req, res) => {
  const users = await withTenant(req.tenantId!, (db) => db.user.findMany({ include: userInclude, orderBy: { id: 'asc' } }));
  res.json(users);
});

usersRouter.get('/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: userInclude });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

const scopeTypeEnum = z.enum(['group', 'region', 'country', 'multi_company', 'company', 'self']);

const createSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  initials: z.string().optional(),
  password: z.string().optional(),
  roleId: z.string().min(1),
  scopeType: scopeTypeEnum.default('company'),
  scopeNodeId: z.string().nullable().optional(),
  scopeLabel: z.string().nullable().optional(),
  status: z.enum(['active', 'invited', 'disabled']).default('active'),
});

usersRouter.post('/users', async (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid user payload', detail: parsed.error.flatten() });
  const d = parsed.data;

  // Enforce plan maxUsers limit before creating
  const current = await prisma.user.count({ where: { tenantId: req.tenantId! } });
  const ent = await loadEntitlements(req.tenantId!);
  const limit = ent.limits.maxUsers;
  if (typeof limit === 'number' && current >= limit) {
    return res.status(402).json({ error: 'Plan user limit reached', limit, current });
  }

  const id = d.id ?? 'u-' + d.email.split('@')[0].replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const passwordHash = await argon2.hash(d.password ?? 'demo1234');
  try {
    const user = await prisma.user.create({
      data: {
        id,
        name: d.name,
        email: d.email,
        initials: d.initials ?? d.name.split(/\s+/).map((s) => s[0]).join('').toUpperCase(),
        passwordHash,
        roleId: d.roleId,
        scopeType: d.scopeType,
        scopeNodeId: d.scopeNodeId ?? null,
        scopeLabel: d.scopeLabel ?? null,
        status: d.status,
        tenantId: req.tenantId!,
      },
      include: userInclude,
    });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

const patchSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  initials: z.string().optional(),
  roleId: z.string().optional(),
  scopeType: scopeTypeEnum.optional(),
  scopeNodeId: z.string().nullable().optional(),
  scopeLabel: z.string().nullable().optional(),
  status: z.enum(['active', 'invited', 'disabled']).optional(),
});

usersRouter.patch('/users/:id', async (req, res) => {
  const parsed = patchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid patch' });
  if (parsed.data.status === 'disabled' && req.params.id === req.user?.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: userInclude,
    });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

const scopeSchema = z.object({
  roleId: z.string().nullable().optional(),
  scopeType: scopeTypeEnum.default('company'),
  scopeNodeId: z.string().nullable().optional(),
  scopeLabel: z.string().nullable().optional(),
  roleLabel: z.string().nullable().optional(),
});

usersRouter.post('/users/:id/scopes', async (req, res) => {
  const parsed = scopeSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid scope payload' });
  try {
    const scope = await prisma.userScope.create({
      data: {
        userId: req.params.id,
        roleId: parsed.data.roleId ?? null,
        scopeType: parsed.data.scopeType,
        scopeNodeId: parsed.data.scopeNodeId ?? null,
        scopeLabel: parsed.data.scopeLabel ?? null,
        roleLabel: parsed.data.roleLabel ?? null,
        tenantId: req.tenantId!,
      },
      include: { role: true, scopeNode: true },
    });
    res.json(scope);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// POST /admin/users/import — bulk-create users from CSV text.
// Header row required: name,email,roleId[,scopeType,scopeLabel,status]
usersRouter.post('/users/import', async (req, res) => {
  const csv = typeof req.body?.csv === 'string' ? req.body.csv.trim() : '';
  if (!csv) return res.status(400).json({ error: 'csv text required' });
  const lines = csv.split(/\r?\n/).filter((l: string) => l.trim());
  if (lines.length < 2) return res.status(400).json({ error: 'CSV needs a header row + at least one data row' });
  const header = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
  const col = (cells: string[], name: string) => {
    const i = header.indexOf(name);
    return i === -1 ? undefined : cells[i]?.trim();
  };
  const created: string[] = [];
  const errors: { row: number; error: string }[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r].split(',');
    const name = col(cells, 'name');
    const email = col(cells, 'email');
    const roleId = col(cells, 'roleid');
    if (!name || !email || !roleId) { errors.push({ row: r + 1, error: 'name, email and roleId are required' }); continue; }
    const id = 'u-' + email.split('@')[0].replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    try {
      const passwordHash = await argon2.hash('demo1234');
      await prisma.user.create({
        data: {
          id, name, email, passwordHash, roleId,
          initials: name.split(/\s+/).map((s) => s[0]).join('').toUpperCase(),
          scopeType: (col(cells, 'scopetype') as never) ?? 'company',
          scopeLabel: col(cells, 'scopelabel') ?? null,
          status: (col(cells, 'status') as never) ?? 'active',
          tenantId: req.tenantId!,
        },
      });
      created.push(email);
    } catch (e) {
      errors.push({ row: r + 1, error: (e as Error).message });
    }
  }
  res.json({ created: created.length, createdEmails: created, errors });
});

usersRouter.delete('/users/:id/scopes/:scopeId', async (req, res) => {
  await prisma.userScope
    .delete({ where: { id: req.params.scopeId } })
    .catch(() => undefined);
  res.json({ ok: true });
});
