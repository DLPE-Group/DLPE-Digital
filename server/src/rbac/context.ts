// Reusable effective-rule builder shared by /me/permissions and the data routes.
// Collects the user's (or a single role's) FieldRule diffs and resolves an
// effective rule per (dataType, field) via most-restrictive-wins.

import { prisma } from '../prisma.js';
import { DATA_TYPES, DEFAULT_RULE, type FieldRuleShape } from '@dlpe/shared';
import { effRule, mergeRules, type RuleMap } from './effectiveRules.js';

export type EffectiveMap = Record<string, Record<string, FieldRuleShape>>;

// Build a nested RuleMap (roleId -> dataTypeId -> fieldId -> diff) from FieldRule rows.
function toRuleMap(
  rows: { roleId: string; dataTypeId: string; fieldId: string; visible: boolean; editable: boolean; masked: boolean; note: string | null }[],
): RuleMap {
  const map: RuleMap = {};
  for (const r of rows) {
    (map[r.roleId] ??= {});
    (map[r.roleId][r.dataTypeId] ??= {});
    map[r.roleId][r.dataTypeId][r.fieldId] = {
      visible: r.visible,
      editable: r.editable,
      masked: r.masked,
      note: r.note ?? undefined,
    };
  }
  return map;
}

// Resolve effective[dataType][field] merged across the given roles (most-restrictive-wins).
function resolveEffective(map: RuleMap, roleIds: string[]): EffectiveMap {
  const effective: EffectiveMap = {};
  for (const dt of DATA_TYPES) {
    effective[dt.id] = {};
    for (const f of dt.fields) {
      let merged: FieldRuleShape = { ...DEFAULT_RULE };
      for (const roleId of roleIds) {
        merged = mergeRules(merged, effRule(map, roleId, dt.id, f.id));
      }
      effective[dt.id][f.id] = merged;
    }
  }
  return effective;
}

// Build the effective rule map for a single user (primary + secondary scope roles).
// Scope ANY for now; scope-specific rows (matching the user's country/node) are merged
// in too if present, so the most-restrictive country override wins.
export async function buildEffectiveForUser(
  userId: string,
): Promise<{ roleIds: string[]; rules: RuleMap; effective: EffectiveMap }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { secondary: true } });
  if (!user) throw new Error(`Unknown user ${userId}`);

  const roleIds = Array.from(
    new Set([user.roleId, ...user.secondary.map((s) => s.roleId).filter((r): r is string => !!r)]),
  );

  const rows = await prisma.fieldRule.findMany({ where: { roleId: { in: roleIds } } });
  const map = toRuleMap(rows);
  return { roleIds, rules: map, effective: resolveEffective(map, roleIds) };
}

// Build the effective rule map for a single role id (used by ?role= preview).
export async function buildEffectiveForRole(
  roleId: string,
): Promise<{ roleIds: string[]; rules: RuleMap; effective: EffectiveMap }> {
  const rows = await prisma.fieldRule.findMany({ where: { roleId } });
  const map = toRuleMap(rows);
  return { roleIds: [roleId], rules: map, effective: resolveEffective(map, [roleId]) };
}
