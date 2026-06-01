import { Router } from 'express';
import { prisma } from '../prisma.js';

export const rolesRouter: Router = Router();

rolesRouter.get('/roles', async (_req, res) => {
  const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } });
  res.json(roles);
});
