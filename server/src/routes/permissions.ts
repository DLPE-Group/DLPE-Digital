import { Router } from 'express';
import { prisma } from '../prisma.js';
import { buildEffectiveForUser } from '../rbac/context.js';
import { userAllowedTracks } from '../domain/cards.service.js';
import { actingUserId } from '../auth/preview.js';

export const permissionsRouter: Router = Router();

// GET /me/permissions
// Returns the effective field-rule map for the current user's role(s):
// a RuleMap (roleId -> dataType -> field -> diff) plus the resolved effective
// map (most-restrictive-wins across the user's primary + secondary roles).
// Admins previewing as another user (x-preview-as) get THAT user's permissions,
// so the side menu / scorecards filter exactly as the previewed user sees them.
permissionsRouter.get('/permissions', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const actingId = actingUserId(req);
  if (!actingId) return res.status(401).json({ error: 'Not authenticated' });

  const actingUser =
    actingId === req.user.id
      ? req.user
      : await prisma.user.findUnique({ where: { id: actingId } });
  if (!actingUser) return res.status(404).json({ error: 'Preview user not found' });

  const { roleIds, rules, effective } = await buildEffectiveForUser(actingId);
  const allowedTracks = await userAllowedTracks(actingId);

  res.json({
    tenantId: req.user?.tenantId,
    roleIds,
    scopeType: actingUser.scopeType,
    scopeNodeId: actingUser.scopeNodeId,
    allowedTracks,
    rules,
    effective,
  });
});
