import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { generateProse } from '../ai/reportProse.js';
import type { ReportSpec } from '@dlpe/shared';
import { withTenant } from '../db/withTenant.js';

export const reportsRouter: Router = Router();

function fmtWhen(d: Date): string {
  return d.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

reportsRouter.get('/', async (req, res) => {
  const reports = await withTenant(req.tenantId!, (db) => db.report.findMany({ orderBy: { createdAt: 'desc' } }));
  res.json(reports.map((r) => ({ id: r.id, spec: r.spec, prose: r.prose, when: r.when })));
});

reportsRouter.get('/:id', async (req, res) => {
  const r = await withTenant(req.tenantId!, (db) => db.report.findUnique({ where: { id: req.params.id } }));
  if (!r) return res.status(404).json({ error: 'Report not found' });
  res.json({ id: r.id, spec: r.spec, prose: r.prose, when: r.when });
});

export const specSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().optional().default(''),
  period: z.string().min(1),
  format: z.string().min(1),
  scope: z.array(z.string()).min(1),
});

reportsRouter.post('/', async (req, res) => {
  const parsed = specSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid report spec' });
  const spec = parsed.data as ReportSpec;
  const prose = await generateProse(spec, req.user?.id);
  const now = new Date();
  const report = await withTenant(req.tenantId!, (db) =>
    db.report.create({
      data: {
        title: spec.title,
        spec: spec as unknown as Prisma.InputJsonValue,
        prose: prose as unknown as Prisma.InputJsonValue,
        when: fmtWhen(now),
        createdById: req.user?.id ?? null,
        tenantId: req.tenantId!,
      },
    }),
  );
  res.json({ id: report.id, spec: report.spec, prose: report.prose, when: report.when });
});

reportsRouter.delete('/:id', async (req, res) => {
  const deleted = await withTenant(req.tenantId!, async (db) => {
    const existing = await db.report.findUnique({ where: { id: req.params.id } });
    if (!existing) return false;
    await db.report.delete({ where: { id: req.params.id } });
    return true;
  });
  if (!deleted) return res.status(404).json({ error: 'Report not found' });
  res.json({ ok: true });
});
