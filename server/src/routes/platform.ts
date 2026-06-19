import { Router } from 'express';
import { prisma } from '../prisma.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { BlueprintSpec } from '@dlpe/shared';
import { provisionTenant } from '../domain/provisioning/provisionTenant.js';
import { SharedDbTarget } from '../domain/provisioning/target.js';
import { billingProvider } from '../domain/billing/provider.js';

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

// PATCH /api/platform/tenants/:id — update tenant status
const statusSchema = z.object({ status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']) });
platformRouter.patch('/tenants/:id', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });
  try {
    const t = await prisma.tenant.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
    return res.json(t);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    throw err;
  }
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

// GET /api/platform/plans — list active plans ordered by tier
platformRouter.get('/plans', async (_req, res) => {
  const plans = await prisma.plan.findMany({ where: { active: true }, orderBy: { tier: 'asc' } });
  return res.json(plans);
});

// GET /api/platform/tenants/:id/subscription — get a tenant's subscription (incl. plan)
platformRouter.get('/tenants/:id/subscription', async (req, res) => {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId: req.params.id },
    include: { plan: true },
  });
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  return res.json(sub);
});

// PATCH /api/platform/tenants/:id/subscription — change a tenant's plan
const changePlanSchema = z.object({ planKey: z.string().min(1) });
platformRouter.patch('/tenants/:id/subscription', async (req, res) => {
  const parsed = changePlanSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'planKey is required and must be a non-empty string' });

  const { planKey } = parsed.data;
  const tenantId = req.params.id;

  try {
    // Check if a subscription exists; if not, create one (resilience over strict 404)
    const existing = await prisma.subscription.findUnique({ where: { tenantId } });
    let state;
    if (!existing) {
      state = await billingProvider.createSubscription({ tenantId, planKey });
    } else {
      state = await billingProvider.changePlan({ tenantId, planKey });
    }
    return res.json(state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Plan not found')) {
      return res.status(404).json({ error: 'Unknown plan' });
    }
    throw err;
  }
});
