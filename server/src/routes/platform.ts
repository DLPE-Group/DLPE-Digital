import { Router } from 'express';
import { prisma } from '../prisma.js';
import { BlueprintSpec } from '@dlpe/shared';
import { provisionTenant } from '../domain/provisioning/provisionTenant.js';
import { SharedDbTarget } from '../domain/provisioning/target.js';

export const platformRouter = Router();

// POST /api/platform/tenants — provision a new tenant from a blueprint
platformRouter.post('/tenants', async (req, res) => {
  const { blueprintKey, inputs, idempotencyKey } = req.body as {
    blueprintKey?: string;
    inputs?: Record<string, unknown>;
    idempotencyKey?: string;
  };

  if (!blueprintKey) {
    return res.status(400).json({ error: 'blueprintKey is required' });
  }

  const blueprint = await prisma.blueprint.findUnique({ where: { key: blueprintKey } });
  if (!blueprint) {
    return res.status(404).json({ error: `Blueprint not found: ${blueprintKey}` });
  }

  const specParsed = BlueprintSpec.safeParse(blueprint.spec);
  if (!specParsed.success) {
    return res.status(422).json({ error: 'Stored blueprint spec is invalid', details: specParsed.error.issues });
  }

  try {
    const result = await provisionTenant({
      blueprint: { id: blueprint.id, spec: specParsed.data },
      inputs: inputs ?? {},
      target: new SharedDbTarget(),
      idempotencyKey,
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/platform/tenants — list tenants
platformRouter.get('/tenants', async (_req, res) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  return res.json(tenants);
});

// GET /api/platform/blueprints — list blueprints
platformRouter.get('/blueprints', async (_req, res) => {
  const blueprints = await prisma.blueprint.findMany({ orderBy: { createdAt: 'desc' } });
  return res.json(blueprints);
});

// POST /api/platform/blueprints — create a blueprint (validates spec)
platformRouter.post('/blueprints', async (req, res) => {
  const { key, name, spec } = req.body as { key?: string; name?: string; spec?: unknown };

  if (!key || !name) {
    return res.status(400).json({ error: 'key and name are required' });
  }

  const specParsed = BlueprintSpec.safeParse(spec);
  if (!specParsed.success) {
    return res.status(400).json({ error: 'Invalid blueprint spec', details: specParsed.error.issues });
  }

  const blueprint = await prisma.blueprint.create({
    data: {
      key,
      name,
      version: specParsed.data.specVersion,
      status: 'DRAFT',
      spec: spec as object,
    },
  });
  return res.status(201).json(blueprint);
});

// GET /api/platform/blueprints/:id/export — return the spec JSON for a blueprint
platformRouter.get('/blueprints/:id/export', async (req, res) => {
  const blueprint = await prisma.blueprint.findUnique({ where: { id: req.params.id } });
  if (!blueprint) {
    return res.status(404).json({ error: 'Blueprint not found' });
  }
  return res.json(blueprint.spec);
});

// POST /api/platform/blueprints/import — import a blueprint (validates spec)
platformRouter.post('/blueprints/import', async (req, res) => {
  const { key, name, spec } = req.body as { key?: string; name?: string; spec?: unknown };

  if (!key || !name) {
    return res.status(400).json({ error: 'key and name are required' });
  }

  const specParsed = BlueprintSpec.safeParse(spec);
  if (!specParsed.success) {
    return res.status(400).json({ error: 'Invalid blueprint spec', details: specParsed.error.issues });
  }

  const blueprint = await prisma.blueprint.create({
    data: {
      key,
      name,
      version: specParsed.data.specVersion,
      status: 'DRAFT',
      spec: spec as object,
    },
  });
  return res.status(201).json(blueprint);
});
