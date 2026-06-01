/* ============================================================
   Data-type field catalogue + default RBAC rule.
   Ported from app/src/admin_data.js (DATA_TYPES, FIELD_CATEGORIES,
   DEFAULT_RULE). Single source for the server + frontend.
   ============================================================ */

export const FIELD_CATEGORIES = ['Identity', 'Commercial', 'Financial', 'Operational', 'Internal'] as const;

export interface FieldDef {
  id: string;
  label: string;
  cat: string;
}
export interface DataTypeDef {
  id: string;
  label: string;
  fields: FieldDef[];
}

export const DATA_TYPES: DataTypeDef[] = [
  {
    id: 'contract', label: 'Contract',
    fields: [
      { id: 'customer_name', label: 'Customer name', cat: 'Identity' },
      { id: 'customer_vat', label: 'Customer VAT number', cat: 'Identity' },
      { id: 'company_owner', label: 'Owning company', cat: 'Identity' },
      { id: 'contract_value', label: 'Contract value', cat: 'Financial' },
      { id: 'monthly_fee', label: 'Monthly lease fee', cat: 'Financial' },
      { id: 'bank_account', label: 'Bank account (IBAN)', cat: 'Financial' },
      { id: 'margin', label: 'Margin %', cat: 'Financial' },
      { id: 'sales_rep', label: 'Sales rep', cat: 'Commercial' },
      { id: 'renewal_date', label: 'Renewal date', cat: 'Commercial' },
      { id: 'term', label: 'Term & duration', cat: 'Commercial' },
      { id: 'notes_internal', label: 'Notes (internal)', cat: 'Internal' },
      { id: 'notes_customer', label: 'Notes (customer-facing)', cat: 'Internal' },
    ],
  },
  {
    id: 'vehicle', label: 'Vehicle',
    fields: [
      { id: 'plate', label: 'Registration plate', cat: 'Identity' },
      { id: 'vin', label: 'VIN', cat: 'Identity' },
      { id: 'model', label: 'Make & model', cat: 'Identity' },
      { id: 'operator', label: 'Fleet operator', cat: 'Commercial' },
      { id: 'lease_value', label: 'Lease book value', cat: 'Financial' },
      { id: 'last_ws_cost', label: 'Last workshop cost', cat: 'Financial' },
      { id: 'maint_cost', label: 'Avg maintenance €/month', cat: 'Financial' },
      { id: 'parts_margin', label: 'Parts margin', cat: 'Financial' },
      { id: 'service_due', label: 'Service due', cat: 'Operational' },
      { id: 'odometer', label: 'Odometer', cat: 'Operational' },
      { id: 'location', label: 'Current location', cat: 'Operational' },
    ],
  },
  {
    id: 'fleet_operator', label: 'Fleet operator',
    fields: [
      { id: 'name', label: 'Operator name', cat: 'Identity' },
      { id: 'vat', label: 'VAT number', cat: 'Identity' },
      { id: 'contact', label: 'Primary contact', cat: 'Identity' },
      { id: 'credit_limit', label: 'Credit limit', cat: 'Financial' },
      { id: 'outstanding', label: 'Outstanding balance', cat: 'Financial' },
      { id: 'lifetime_value', label: 'Lifetime value', cat: 'Financial' },
      { id: 'fleet_size', label: 'Fleet size', cat: 'Operational' },
      { id: 'account_mgr', label: 'Account manager', cat: 'Commercial' },
    ],
  },
  {
    id: 'invoice', label: 'Invoice',
    fields: [
      { id: 'number', label: 'Invoice number', cat: 'Identity' },
      { id: 'counterparty', label: 'Counterparty', cat: 'Identity' },
      { id: 'amount', label: 'Amount', cat: 'Financial' },
      { id: 'vat_amount', label: 'VAT amount', cat: 'Financial' },
      { id: 'bank_account', label: 'Bank account (IBAN)', cat: 'Financial' },
      { id: 'payment_status', label: 'Payment status', cat: 'Financial' },
      { id: 'due_date', label: 'Due date', cat: 'Operational' },
      { id: 'peppol_id', label: 'PEPPOL endpoint', cat: 'Internal' },
    ],
  },
  {
    id: 'workshop_order', label: 'Workshop order',
    fields: [
      { id: 'wo_number', label: 'Order number', cat: 'Identity' },
      { id: 'vehicle', label: 'Vehicle', cat: 'Identity' },
      { id: 'labor_cost', label: 'Labor cost', cat: 'Financial' },
      { id: 'parts_cost', label: 'Parts cost', cat: 'Financial' },
      { id: 'parts_margin', label: 'Parts margin', cat: 'Financial' },
      { id: 'status', label: 'Repair status', cat: 'Operational' },
      { id: 'eta', label: 'Expected completion', cat: 'Operational' },
    ],
  },
];

export interface FieldRuleShape {
  visible: boolean;
  editable: boolean;
  masked: boolean;
  note?: string;
}

export const DEFAULT_RULE: FieldRuleShape = { visible: true, editable: true, masked: false };
