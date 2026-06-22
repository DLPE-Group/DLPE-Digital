import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';

export const integrationsRouter: Router = Router();

integrationsRouter.get('/', async (req, res) => {
  const rows = await withTenant(req.tenantId!, (db) => db.integration.findMany({ orderBy: { id: 'asc' } }));
  res.json(rows);
});

export const addSchema = z.object({
  name: z.string().min(1),
  kind: z.string().optional().default('Integration · via Nango'),
  direction: z.string().optional().default('inbound'),
  logo: z.string().optional().default('N'),
  desc: z.string().optional().default('Connected via Nango.'),
});

// Simulated Nango add — creates an Integration row flagged nango=true.
integrationsRouter.post('/', async (req, res) => {
  const parsed = addSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'name required' });
  const d = parsed.data;
  const id = 'nango-' + d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
  const row = await withTenant(req.tenantId!, (db) => db.integration.create({
    data: {
      id,
      name: d.name,
      kind: d.kind,
      direction: d.direction,
      logo: d.logo,
      status: 'healthy',
      lastSync: 'just now',
      throughput: '0 records today',
      latency: 'real-time',
      desc: d.desc,
      nango: true,
      transforms: 0,
      tenantId: req.tenantId!,
    },
  }));
  res.json(row);
});

// PATCH /integrations/:id — edit an integration's config fields.
const patchIntegrationSchema = z.object({
  name: z.string().optional(),
  kind: z.string().optional(),
  direction: z.string().optional(),
  desc: z.string().optional(),
  status: z.string().optional(),
}).partial();
integrationsRouter.patch('/:id', async (req, res) => {
  const parsed = patchIntegrationSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid integration patch' });
  try {
    const row = await withTenant(req.tenantId!, (db) => db.integration.update({ where: { id: req.params.id }, data: parsed.data }));
    res.json(row);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

// GET /integrations/:id/logs — recent activity for this integration. Derived
// from system audit entries (real events flowing through the DataSource).
integrationsRouter.get('/:id/logs', async (req, res) => {
  const result = await withTenant(req.tenantId!, async (db) => {
    const it = await db.integration.findUnique({ where: { id: req.params.id } });
    if (!it) return null;
    const sys = await db.auditEntry.findMany({ where: { isSystem: true }, orderBy: { createdAt: 'desc' }, take: 12 });
    const lines = sys.map((a) => ({ when: `${a.day} · ${a.time}`, text: `${a.verb} — ${a.target}` }));
    return { integration: { id: it.id, name: it.name, status: it.status, lastSync: it.lastSync }, lines };
  });
  if (!result) return res.status(404).json({ error: 'Integration not found' });
  res.json(result);
});

// DELETE /integrations/:id — remove a connector.
integrationsRouter.delete('/:id', async (req, res) => {
  const result = await withTenant(req.tenantId!, async (db) => {
    const existing = await db.integration.findUnique({ where: { id: req.params.id } });
    if (!existing) return false;
    await db.integration.delete({ where: { id: req.params.id } });
    return true;
  });
  if (!result) return res.status(404).json({ error: 'Integration not found' });
  res.json({ ok: true });
});

// POST /integrations/:id/test — "test connection": marks healthy + bumps lastSync.
integrationsRouter.post('/:id/test', async (req, res) => {
  const result = await withTenant(req.tenantId!, async (db) => {
    const existing = await db.integration.findUnique({ where: { id: req.params.id } });
    if (!existing) return null;
    const row = await db.integration.update({
      where: { id: req.params.id },
      data: { status: 'healthy', lastSync: 'just now' },
    });
    return row;
  });
  if (!result) return res.status(404).json({ error: 'Integration not found' });
  res.json({ ok: true, integration: result });
});
