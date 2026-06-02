import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const fieldRulesRouter: Router = Router();

const RULE_SCOPES = ['ANY', 'NL', 'BE', 'DE', 'ROTTERDAM'] as const;

// GET /admin/field-rules?role=&dataType=&scope=
fieldRulesRouter.get('/field-rules', async (req, res) => {
  const where: { roleId?: string; dataTypeId?: string; scope?: (typeof RULE_SCOPES)[number] } = {};
  if (typeof req.query.role === 'string') where.roleId = req.query.role;
  if (typeof req.query.dataType === 'string') where.dataTypeId = req.query.dataType;
  if (typeof req.query.scope === 'string' && (RULE_SCOPES as readonly string[]).includes(req.query.scope)) {
    where.scope = req.query.scope as (typeof RULE_SCOPES)[number];
  }
  const rules = await prisma.fieldRule.findMany({ where, orderBy: [{ roleId: 'asc' }, { dataTypeId: 'asc' }, { fieldId: 'asc' }] });
  res.json(rules);
});

const ruleSchema = z.object({
  roleId: z.string().min(1),
  dataTypeId: z.string().min(1),
  fieldId: z.string().min(1),
  scope: z.enum(RULE_SCOPES).default('ANY'),
  visible: z.boolean(),
  editable: z.boolean(),
  masked: z.boolean(),
  note: z.string().nullable().optional(),
});

const bulkSchema = z.object({
  diffs: z.array(ruleSchema),
  actor: z.string().optional(),
  note: z.string().optional(),
});

// PUT /admin/field-rules — bulk upsert diffs + bump RbacVersion.
fieldRulesRouter.put('/field-rules', async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid field-rules payload', detail: parsed.error.flatten() });
  const { diffs } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const upserted = [];
    for (const r of diffs) {
      upserted.push(
        await tx.fieldRule.upsert({
          where: { roleId_dataTypeId_fieldId_scope: { roleId: r.roleId, dataTypeId: r.dataTypeId, fieldId: r.fieldId, scope: r.scope } },
          update: { visible: r.visible, editable: r.editable, masked: r.masked, note: r.note ?? null },
          create: { roleId: r.roleId, dataTypeId: r.dataTypeId, fieldId: r.fieldId, scope: r.scope, visible: r.visible, editable: r.editable, masked: r.masked, note: r.note ?? null },
        }),
      );
    }
    // Snapshot the FULL effective rule set so this version can be reverted to.
    const allRules = await tx.fieldRule.findMany();
    const snapshot = allRules.map((r) => ({
      roleId: r.roleId, dataTypeId: r.dataTypeId, fieldId: r.fieldId, scope: r.scope,
      visible: r.visible, editable: r.editable, masked: r.masked, note: r.note,
    }));
    const top = await tx.rbacVersion.findFirst({ orderBy: { v: 'desc' } });
    const v = (top?.v ?? 0) + 1;
    const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const version = await tx.rbacVersion.create({
      data: {
        v, when: `Today · ${when}`,
        actor: parsed.data.actor ?? 'System',
        note: parsed.data.note ?? `Updated ${diffs.length} field rule(s)`,
        snapshot: snapshot as unknown as object,
      },
    });
    return { upserted, version };
  });

  res.json(result);
});

fieldRulesRouter.get('/rbac/versions', async (_req, res) => {
  const versions = await prisma.rbacVersion.findMany({ orderBy: { v: 'desc' } });
  res.json(versions);
});

// POST /admin/rbac/versions/:v/revert — restore the FieldRule set captured in
// version :v, transactionally, and record a new version documenting the revert.
fieldRulesRouter.post('/rbac/versions/:v/revert', async (req, res) => {
  const targetV = Number(req.params.v);
  if (!Number.isInteger(targetV)) return res.status(400).json({ error: 'Invalid version' });
  const target = await prisma.rbacVersion.findUnique({ where: { v: targetV } });
  if (!target) return res.status(404).json({ error: 'Version not found' });
  if (!target.snapshot) {
    return res.status(409).json({ error: 'This version has no stored snapshot to revert to (pre-snapshot version).' });
  }
  const rules = target.snapshot as unknown as Array<{
    roleId: string; dataTypeId: string; fieldId: string;
    scope: (typeof RULE_SCOPES)[number]; visible: boolean; editable: boolean; masked: boolean; note: string | null;
  }>;

  const result = await prisma.$transaction(async (tx) => {
    await tx.fieldRule.deleteMany({});
    if (rules.length) await tx.fieldRule.createMany({ data: rules });
    const top = await tx.rbacVersion.findFirst({ orderBy: { v: 'desc' } });
    const v = (top?.v ?? 0) + 1;
    const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const version = await tx.rbacVersion.create({
      data: {
        v, when: `Today · ${when}`,
        actor: (typeof req.body?.actor === 'string' ? req.body.actor : 'System'),
        note: `Reverted to v${targetV}`,
        snapshot: rules as unknown as object,
      },
    });
    return { restored: rules.length, version };
  });

  res.json(result);
});
