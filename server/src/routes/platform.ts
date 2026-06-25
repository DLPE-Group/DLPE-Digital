import { Router } from 'express';
import { prisma } from '../prisma.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { BlueprintSpec } from '@dlpe/shared';
import { provisionTenant } from '../domain/provisioning/provisionTenant.js';
import { SharedDbTarget } from '../domain/provisioning/target.js';
import { billingProvider } from '../domain/billing/provider.js';
import { captureBlueprint } from '../domain/provisioning/captureBlueprint.js';
import { validateInputs, resolveSlugName, resolvePlanKey, summarizeBlueprint } from '../domain/provisioning/derive.js';

export const platformRouter = Router();

// POST /api/platform/tenants — provision a new tenant from a blueprint
platformRouter.post('/tenants', async (req, res) => {
  const { blueprintKey, inputs, idempotencyKey, admin, planKey } = req.body as {
    blueprintKey?: string;
    inputs?: Record<string, unknown>;
    idempotencyKey?: string;
    admin?: { name?: string; email?: string; password?: string };
    planKey?: string;
  };

  if (!blueprintKey) {
    return res.status(400).json({ error: 'blueprintKey is required' });
  }

  if (admin?.email !== undefined && !z.string().email().safeParse(admin.email).success) {
    return res.status(400).json({ error: 'admin.email must be a valid email' });
  }

  // An explicit admin password makes the admin active (can log in immediately);
  // omitting it keeps the blueprint's behaviour (invite flow for the clean templates).
  if (admin?.password !== undefined && !z.string().min(8).safeParse(admin.password).success) {
    return res.status(400).json({ error: 'admin.password must be at least 8 characters' });
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
      adminOverride: admin,
      planKey,
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/platform/provision/preflight — dry-run validation + summary (no writes)
platformRouter.post('/provision/preflight', async (req, res) => {
  const { blueprintKey, inputs, admin, planKey } = req.body as {
    blueprintKey?: string;
    inputs?: Record<string, unknown>;
    admin?: { name?: string; email?: string };
    planKey?: string;
  };
  if (!blueprintKey) return res.status(400).json({ error: 'blueprintKey is required' });

  const blueprint = await prisma.blueprint.findUnique({ where: { key: blueprintKey } });
  if (!blueprint) return res.status(404).json({ error: `Blueprint not found: ${blueprintKey}` });

  const specParsed = BlueprintSpec.safeParse(blueprint.spec);
  if (!specParsed.success) {
    return res.status(422).json({ error: 'Stored blueprint spec is invalid', details: specParsed.error.issues });
  }
  const spec = specParsed.data;
  const safeInputs = inputs ?? {};

  const issues: Array<{ level: 'error' | 'warning'; message: string }> = [];

  // inputs
  const inputCheck = validateInputs(spec, safeInputs);
  if (!inputCheck.ok) {
    issues.push({ level: 'error', message: `Missing required inputs: ${inputCheck.missing.join(', ')}` });
  }

  // slug
  const { slug } = resolveSlugName(spec, safeInputs);
  const slugTaken = (await prisma.tenant.findUnique({ where: { slug } })) != null;
  if (slugTaken) issues.push({ level: 'error', message: `Slug already in use: ${slug}` });

  // plan
  const resolvedPlanKey = resolvePlanKey(spec, planKey);
  const planExists = (await prisma.plan.findUnique({ where: { key: resolvedPlanKey } })) != null;
  if (!planExists) issues.push({ level: 'warning', message: `Unknown plan '${resolvedPlanKey}' — subscription will be skipped` });

  const adminEmail = admin?.email ?? spec.adminUser.email;

  if (admin?.email !== undefined && !z.string().email().safeParse(admin.email).success) {
    issues.push({ level: 'error', message: 'admin.email is not a valid email' });
  }

  return res.json({
    ok: !issues.some((i) => i.level === 'error'),
    slug,
    slugAvailable: !slugTaken,
    resolvedPlanKey,
    planExists,
    summary: summarizeBlueprint(spec),
    adminEmail,
    issues,
  });
});

// GET /api/platform/tenants — list tenants
platformRouter.get('/tenants', async (_req, res) => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { subscription: { include: { plan: true } } },
  });
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

// POST /api/platform/tenants/:id/capture — capture a live tenant into a DRAFT blueprint
const captureSchema = z.object({ key: z.string().min(1), name: z.string().min(1) });
platformRouter.post('/tenants/:id/capture', async (req, res) => {
  const parsed = captureSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'key and name are required' });
  const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  let spec;
  try { spec = await captureBlueprint(prisma, req.params.id); }
  catch (e) { return res.status(422).json({ error: 'Capture failed: ' + (e as Error).message }); }
  try {
    const bp = await prisma.blueprint.create({
      data: { key: parsed.data.key, name: parsed.data.name, status: 'DRAFT', spec: spec as unknown as Prisma.InputJsonValue, sourceTenantId: req.params.id },
    });
    return res.json(bp);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return res.status(409).json({ error: 'Blueprint key already exists' });
    throw e;
  }
});

// PATCH /api/platform/blueprints/:id — update blueprint status (lifecycle)
const bpStatusSchema = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) });
platformRouter.patch('/blueprints/:id', async (req, res) => {
  const parsed = bpStatusSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });
  try {
    const bp = await prisma.blueprint.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
    return res.json(bp);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return res.status(404).json({ error: 'Blueprint not found' });
    throw e;
  }
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
