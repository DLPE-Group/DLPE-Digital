// Apply a user's effective field rules to LIVE pipeline cards (not just the
// /records preview). Maps live card fields → the RBAC dataType.field that
// governs them, then strips hidden fields / masks masked fields.
import { maskValue } from './mask.js';
import type { EffectiveMap } from './context.js';
import type { Card } from '@prisma/client';

// card field -> governing { dataType, field } rule.
const CARD_FIELD_MAP: Record<string, { dataType: string; field: string }> = {
  value: { dataType: 'contract', field: 'contract_value' },
  customer: { dataType: 'contract', field: 'customer_name' },
  owner: { dataType: 'contract', field: 'sales_rep' },
};

export function filterCard(card: Card, effective: EffectiveMap): Card {
  let out: Record<string, unknown> = card;
  let cloned = false;
  const ensure = () => { if (!cloned) { out = { ...card }; cloned = true; } };

  for (const [cardField, { dataType, field }] of Object.entries(CARD_FIELD_MAP)) {
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
  return out as Card;
}

// True when the user cannot fully see monetary contract values (hidden or
// masked) — used to gate money aggregates.
export function valueRestricted(effective: EffectiveMap): boolean {
  const rule = effective.contract?.contract_value;
  return !!rule && (rule.visible === false || rule.masked === true);
}
