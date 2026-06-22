import { Router } from 'express';
import { listAudit, revertAudit, RevertError } from '../domain/audit.service.js';
import { withTenant } from '../db/withTenant.js';

export const auditRouter: Router = Router();

auditRouter.get('/', async (req, res) => {
  const filter = typeof req.query.filter === 'string' ? req.query.filter : 'all';
  const entries = await withTenant(req.tenantId!, (db) => listAudit(filter, db));
  res.json(entries);
});

auditRouter.post('/:id/revert', async (req, res) => {
  const actor = { name: req.user?.name ?? 'Unknown', roleId: req.user?.roleId ?? 'unknown' };
  try {
    const result = await withTenant(req.tenantId!, (db) => revertAudit(req.params.id, actor, db, req.tenantId!));
    res.json(result);
  } catch (e) {
    if (e instanceof RevertError) return res.status(e.status).json({ error: e.message });
    res.status(400).json({ error: (e as Error).message });
  }
});
