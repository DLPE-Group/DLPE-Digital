import { Router } from 'express';
import { listAudit, revertAudit, RevertError } from '../domain/audit.service.js';

export const auditRouter: Router = Router();

auditRouter.get('/', async (req, res) => {
  const filter = typeof req.query.filter === 'string' ? req.query.filter : 'all';
  res.json(await listAudit(filter));
});

auditRouter.post('/:id/revert', async (req, res) => {
  const actor = { name: req.user?.name ?? 'Unknown', roleId: req.user?.roleId ?? 'unknown' };
  try {
    const result = await revertAudit(req.params.id, actor);
    res.json(result);
  } catch (e) {
    if (e instanceof RevertError) return res.status(e.status).json({ error: e.message });
    res.status(400).json({ error: (e as Error).message });
  }
});
