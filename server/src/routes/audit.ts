import { Router } from 'express';
import { listAudit } from '../domain/audit.service.js';

export const auditRouter: Router = Router();

auditRouter.get('/', async (req, res) => {
  const filter = typeof req.query.filter === 'string' ? req.query.filter : 'all';
  res.json(await listAudit(filter));
});
