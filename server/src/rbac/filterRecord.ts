// Apply an effective rule map to a single record: omit hidden fields, mask
// masked fields, and collect read-only keys. Returns the filtered record plus
// __hidden and __readonly metadata for the UI.

import { maskValue } from './mask.js';
import type { EffectiveMap } from './context.js';

export interface FilteredRecord {
  [key: string]: unknown;
  __hidden: string[];
  __readonly: string[];
}

export function filterRecord(
  record: Record<string, unknown>,
  dataTypeId: string,
  effective: EffectiveMap,
): FilteredRecord {
  const rules = effective[dataTypeId] || {};
  const out: Record<string, unknown> = {};
  const __hidden: string[] = [];
  const __readonly: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    const rule = rules[key];
    // No rule for this field => default (visible, editable, not masked).
    if (rule && rule.visible === false) {
      __hidden.push(key);
      continue;
    }
    if (rule && rule.masked) {
      out[key] = maskValue(key, String(value));
    } else {
      out[key] = value;
    }
    if (rule && rule.editable === false) __readonly.push(key);
  }

  return { ...out, __hidden, __readonly };
}
