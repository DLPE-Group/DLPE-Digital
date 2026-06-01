import { Router } from 'express';
import { prisma } from '../prisma.js';
import { DATA_TYPES, DEFAULT_RULE } from '@dlpe/shared';
import { effRule, mergeRules, type RuleMap } from '../rbac/effectiveRules.js';

export const permissionsRouter: Router = Router();

// GET /me/permissions
// Phase 1: return the effective field-rule map for the current user's role(s)
// WITHOUT enforcing it on data routes. Builds a RuleMap from FieldRule rows for
// the user's primary + secondary roles, then resolves each data-type/field via
// most-restrictive-wins so the frontend has a usable permission map.
permissionsRouter.get('/permissions', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const roleIds = Array.from(
    new Set([user.roleId, ...user.secondaryScopes.map((s) => s.roleId).filter((r): r is string => !!r)]),
  );

  // Pull FieldRule diffs for these roles (scope ANY for Phase 1).
  const rules = await prisma.fieldRule.findMany({ where: { roleId: { in: roleIds }, scope: 'ANY' } });

  // Build the nested RuleMap (roleId -> dataTypeId -> fieldId -> diff).
  const map: RuleMap = {};
  for (const r of rules) {
    (map[r.roleId] ??= {});
    (map[r.roleId][r.dataTypeId] ??= {});
    map[r.roleId][r.dataTypeId][r.fieldId] = {
      visible: r.visible,
      editable: r.editable,
      masked: r.masked,
      note: r.note ?? undefined,
    };
  }

  // Resolve effective rule per (dataType, field) merged across the user's roles.
  const effective: Record<string, Record<string, ReturnType<typeof effRule>>> = {};
  for (const dt of DATA_TYPES) {
    effective[dt.id] = {};
    for (const f of dt.fields) {
      let merged = { ...DEFAULT_RULE };
      for (const roleId of roleIds) {
        merged = mergeRules(merged, effRule(map, roleId, dt.id, f.id));
      }
      effective[dt.id][f.id] = merged;
    }
  }

  res.json({
    roleIds,
    scopeType: user.scopeType,
    scopeNodeId: user.scopeNodeId,
    rules: map,
    effective,
  });
});
