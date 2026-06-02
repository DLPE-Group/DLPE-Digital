// Apply a user's effective field rules to LIVE pipeline cards (not just the
// /records preview). Each pipeline EntityType is governed INDEPENDENTLY: a
// card's envelope fields map to its own type's RBAC dataType.field, so hiding
// "contract value" masks Sales/Contract cards but not Invoices or Workshop
// orders. Aggregates follow because masked values become null and drop out of
// sums (see aggregations.ts).
import { maskValue } from './mask.js';
import type { EffectiveMap } from './context.js';
import type { CardDTO as Card } from '@dlpe/shared';

// Track enum → the pipeline EntityType key that governs its cards.
const TYPE_KEY_BY_TRACK: Record<string, string> = {
  SALES: 'contract',
  OPERATIONS: 'operation',
  WORKSHOP: 'workshop_order',
  FINANCE: 'invoice',
};

// Per-EntityType: which { dataType, field } rule governs each envelope field.
// A field with no mapping for a given type is never restricted (always visible).
const FIELD_MAP_BY_TYPE: Record<string, Record<string, { dataType: string; field: string }>> = {
  contract: {
    value: { dataType: 'contract', field: 'contract_value' },
    customer: { dataType: 'contract', field: 'customer_name' },
    owner: { dataType: 'contract', field: 'sales_rep' },
  },
  invoice: {
    value: { dataType: 'invoice', field: 'amount' },
    customer: { dataType: 'invoice', field: 'counterparty' },
  },
  workshop_order: {
    value: { dataType: 'workshop_order', field: 'labor_cost' },
  },
  operation: {},
};

function typeKeyForCard(card: Card): string {
  return TYPE_KEY_BY_TRACK[card.track as unknown as string] ?? 'operation';
}

export function filterCard(card: Card, effective: EffectiveMap): Card {
  const fieldMap = FIELD_MAP_BY_TYPE[typeKeyForCard(card)] ?? {};
  let out: Record<string, unknown> = card as unknown as Record<string, unknown>;
  let cloned = false;
  const ensure = () => { if (!cloned) { out = { ...card }; cloned = true; } };

  for (const [cardField, { dataType, field }] of Object.entries(fieldMap)) {
    const rule = effective[dataType]?.[field];
    if (!rule) continue;
    if (rule.visible === false) {
      ensure();
      out[cardField] = null;
    } else if (rule.masked) {
      ensure();
      const v = out[cardField];
      if (v != null) out[cardField] = maskValue(cardField, String(v));
    }
  }
  return out as unknown as Card;
}

// True when the caller cannot fully see monetary values for a given pipeline
// EntityType (hidden or masked) — used to gate that type's money aggregates so
// the dashboard "follows" per-type field rules.
export function valueRestricted(effective: EffectiveMap, typeKey = 'contract'): boolean {
  const map = FIELD_MAP_BY_TYPE[typeKey]?.value;
  if (!map) return false;
  const rule = effective[map.dataType]?.[map.field];
  return !!rule && (rule.visible === false || rule.masked === true);
}
