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
    const top = await tx.rbacVersion.findFirst({ orderBy: { v: 'desc' } });
    const v = (top?.v ?? 0) + 1;
    const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const version = await tx.rbacVersion.create({
      data: { v, when: `Today · ${when}`, actor: parsed.data.actor ?? 'System', note: parsed.data.note ?? `Updated ${diffs.length} field rule(s)` },
    });
    return { upserted, version };
  });

  res.json(result);
});

fieldRulesRouter.get('/rbac/versions', async (_req, res) => {
  const versions = await prisma.rbacVersion.findMany({ orderBy: { v: 'desc' } });
  res.json(versions);
});
