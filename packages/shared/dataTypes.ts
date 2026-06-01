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

/* Sample record values for the live preview pane + /records demo endpoint.
   Ported from app/src/admin_data.js (SAMPLE_RECORDS). Static demo data. */
export const SAMPLE_RECORDS: Record<string, Record<string, string>> = {
  contract: {
    customer_name: 'Rotterdam Logistics B.V.', customer_vat: 'NL8021.94.331.B01',
    company_owner: 'Rotterdam Branch', contract_value: '€1,240,000', monthly_fee: '€18,400 / mo',
    bank_account: 'NL91 ABNA 0417 1643 00', margin: '14.2%', sales_rep: 'Eva de Vries',
    renewal_date: '14 Mar 2027', term: '48 months · full-service lease',
    notes_internal: 'Price-sensitive; competitor quote on file.', notes_customer: 'Quarterly review scheduled.',
  },
  vehicle: {
    plate: 'TRK-7702', vin: 'WMA06XZZ4PM••••12', model: 'MAN TGS 26.420', operator: 'Düsseldorf Bau B.V.',
    lease_value: '€96,400', last_ws_cost: '€3,180', maint_cost: '€412 / mo', parts_margin: '22%',
    service_due: 'in 12 days', odometer: '184,200 km', location: 'Düsseldorf workshop',
  },
  fleet_operator: {
    name: 'Rotterdam Logistics B.V.', vat: 'NL8021.94.331.B01', contact: 'J. Bakker',
    credit_limit: '€2,000,000', outstanding: '€184,200', lifetime_value: '€8.4M',
    fleet_size: '47 vehicles', account_mgr: 'Eva de Vries',
  },
  invoice: {
    number: 'ROT-2026-0481', counterparty: 'Amsterdam Cold Chain N.V.', amount: '€18,400',
    vat_amount: '€3,864', bank_account: 'NL91 ABNA 0417 1643 00', payment_status: 'Awaiting payment',
    due_date: '30 Jun 2026', peppol_id: '0190:NL8021943310000',
  },
  workshop_order: {
    wo_number: 'WO-2026-118', vehicle: 'TRK-7702 · MAN TGS', labor_cost: '€1,640',
    parts_cost: '€1,540', parts_margin: '22%', status: 'In repair · brakes', eta: '02 Jun 2026',
  },
};
