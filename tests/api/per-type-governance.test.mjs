import { describe, it, expect } from 'vitest';
import { filterCard, valueRestricted } from '../../server/src/rbac/applyCardRules.ts';

// Per-EntityType field governance: hiding "contract value" masks Sales/Contract
// cards but NOT Invoices (finance) — each type follows its own rules.
const hideContractValue = {
  contract: { contract_value: { visible: false, editable: false, masked: false } },
};
const maskInvoiceAmount = {
  invoice: { amount: { visible: true, editable: false, masked: true } },
};

describe('per-EntityType field governance', () => {
  it('hiding contract_value nulls Sales card value but leaves Finance/Invoice value intact', () => {
    const sales = { track: 'sales', value: 120000, customer: 'Acme', owner: 'Eva' };
    const finance = { track: 'finance', value: 5000, customer: 'Acme Invoice', owner: 'Ines' };
    expect(filterCard(sales, hideContractValue).value).toBe(null);
    expect(filterCard(finance, hideContractValue).value).toBe(5000); // invoice.amount has no rule
  });

  it('masking invoice amount masks Finance card value but leaves Sales value intact', () => {
    const sales = { track: 'sales', value: 120000 };
    const finance = { track: 'finance', value: 5000 };
    expect(filterCard(sales, maskInvoiceAmount).value).toBe(120000);
    expect(typeof filterCard(finance, maskInvoiceAmount).value).toBe('string'); // masked
  });

  it('valueRestricted is per-type (aggregates follow)', () => {
    expect(valueRestricted(hideContractValue, 'contract')).toBe(true);
    expect(valueRestricted(hideContractValue, 'invoice')).toBe(false);
    expect(valueRestricted(maskInvoiceAmount, 'invoice')).toBe(true);
    expect(valueRestricted(maskInvoiceAmount, 'contract')).toBe(false);
  });
});
