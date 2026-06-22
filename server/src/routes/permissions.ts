import { Router } from 'express';
import { buildEffectiveForUser } from '../rbac/context.js';
import { userAllowedTracks } from '../domain/cards.service.js';
import { actingUserId } from '../auth/preview.js';
import { withTenant } from '../db/withTenant.js';

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

  const result = await withTenant(req.tenantId!, async (db) => {
    const actingUser =
      actingId === req.user!.id
        ? req.user!
        : await db.user.findUnique({ where: { id: actingId } });
    if (!actingUser) return null;

    const [{ roleIds, rules, effective }, allowedTracks] = await Promise.all([
      buildEffectiveForUser(actingId, db),
      userAllowedTracks(actingId, db),
    ]);

    return { actingUser, roleIds, rules, effective, allowedTracks };
  });

  if (!result) return res.status(404).json({ error: 'Preview user not found' });

  res.json({
    tenantId: req.user?.tenantId,
    platformAdmin: req.user?.platformAdmin ?? false,
    roleIds: result.roleIds,
    scopeType: result.actingUser.scopeType,
    scopeNodeId: result.actingUser.scopeNodeId,
    allowedTracks: result.allowedTracks,
    rules: result.rules,
    effective: result.effective,
  });
});
