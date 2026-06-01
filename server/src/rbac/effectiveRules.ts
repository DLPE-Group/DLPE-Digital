// Lifted from app/src/admin_rbac.jsx (`effRule`, `isModified`).
// Phase 2 wires these into per-record response filtering; Phase 1 only lifts them.

import { DEFAULT_RULE, type FieldRuleShape } from '@dlpe/shared';

// In-memory rule map shape: roleId -> dataTypeId -> fieldId -> partial rule (diffs).
export type RuleMap = Record<string, Record<string, Record<string, Partial<FieldRuleShape>>>>;

export function effRule(
  rules: RuleMap,
  roleId: string,
  dtId: string,
  fieldId: string,
): FieldRuleShape {
  const o = rules[roleId]?.[dtId]?.[fieldId];
  return { ...DEFAULT_RULE, ...(o || {}) };
}

export function isModified(
  rules: RuleMap,
  roleId: string,
  dtId: string,
  fieldId: string,
): boolean {
  return !!rules[roleId]?.[dtId]?.[fieldId];
}

// Most-restrictive-wins merge across multiple (role,scope) rule sets.
// visible = AND, editable = AND && visible, masked = OR.
export function mergeRules(a: FieldRuleShape, b: FieldRuleShape): FieldRuleShape {
  const visible = a.visible && b.visible;
  const masked = a.masked || b.masked;
  const editable = a.editable && b.editable && visible;
  return { visible, editable, masked, note: a.note || b.note };
}
