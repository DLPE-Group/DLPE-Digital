import { Router } from 'express';
import { buildEffectiveForUser } from '../rbac/context.js';

export const permissionsRouter: Router = Router();

// GET /me/permissions
// Returns the effective field-rule map for the current user's role(s):
// a RuleMap (roleId -> dataType -> field -> diff) plus the resolved effective
// map (most-restrictive-wins across the user's primary + secondary roles).
permissionsRouter.get('/permissions', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { roleIds, rules, effective } = await buildEffectiveForUser(user.id);

  res.json({
    roleIds,
    scopeType: user.scopeType,
    scopeNodeId: user.scopeNodeId,
    rules,
    effective,
  });
});
