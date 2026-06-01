import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const integrationsRouter: Router = Router();

integrationsRouter.get('/', async (_req, res) => {
  const rows = await prisma.integration.findMany({ orderBy: { id: 'asc' } });
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
  const row = await prisma.integration.create({
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
    },
  });
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
    const row = await prisma.integration.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(row);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

// POST /integrations/:id/test — "test connection": marks healthy + bumps lastSync.
integrationsRouter.post('/:id/test', async (req, res) => {
  const existing = await prisma.integration.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Integration not found' });
  const row = await prisma.integration.update({
    where: { id: req.params.id },
    data: { status: 'healthy', lastSync: 'just now' },
  });
  res.json({ ok: true, integration: row });
});
