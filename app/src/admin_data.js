/* ============================================================
   Admin / RBAC mock data — Group structure, users, roles,
   data-type field definitions and per-role field rules.
   ============================================================ */

/* ---------- Country regulatory defaults ---------- */
export const COUNTRY_DEFAULTS = {
  NL: { vat: '21%', currency: 'EUR', peppol: 'BIS Billing 3.0 · NL profile', languages: 'Dutch', fiscalYear: '1 Jan' },
  BE: { vat: '21%', currency: 'EUR', peppol: 'BIS Billing 3.0 · BE profile', languages: 'Dutch · French', fiscalYear: '1 Jan' },
  LU: { vat: '17%', currency: 'EUR', peppol: 'BIS Billing 3.0 · standard',  languages: 'French · German', fiscalYear: '1 Jan' },
  DE: { vat: '19%', currency: 'EUR', peppol: 'BIS Billing 3.0 · DE profile', languages: 'German', fiscalYear: '1 Jan' },
};

/* ---------- Group → Region/Country → Company tree ---------- */
export const GROUP_TREE = {
  id: 'grp', kind: 'group', name: 'Holding group', code: 'GRP',
  meta: { entity: 'Top-level holding · 1 per deployment', address: '—' },
  settings: {
    serviceInterval: '40,000 km / 24 months',
    workingHours: '5-day week',
  },
  children: [
    {
      id: 'reg-benelux', kind: 'region', name: 'Benelux', code: 'BNL',
      meta: { manager: 'Tom Janssens · Regional director' },
      children: [
        {
          id: 'co-nl', kind: 'country', name: 'Netherlands', code: 'NL',
          settings: COUNTRY_DEFAULTS.NL,
          children: [
            { id: 'cmp-rotterdam', kind: 'company', name: 'Rotterdam Branch', code: 'NL-ROT',
              meta: { entity: 'BV · KvK 24 481 902', address: 'Waalhaven 12, Rotterdam' },
              overrides: { invoiceSeq: 'ROT-2026-####' } },
            { id: 'cmp-amsterdam', kind: 'company', name: 'Amsterdam Branch', code: 'NL-AMS',
              meta: { entity: 'BV · KvK 33 902 117', address: 'Westpoort 88, Amsterdam' },
              overrides: { invoiceSeq: 'AMS-2026-####' } },
          ],
        },
        {
          id: 'co-be', kind: 'country', name: 'Belgium', code: 'BE',
          settings: COUNTRY_DEFAULTS.BE,
          children: [
            { id: 'cmp-antwerp', kind: 'company', name: 'Antwerp Branch', code: 'BE-ANT',
              meta: { entity: 'NV · BCE 0461.902.331', address: 'Noorderlaan 4, Antwerpen' },
              overrides: { invoiceSeq: 'ANT-2026-####', languages: 'Dutch' } },
            { id: 'cmp-brussels', kind: 'company', name: 'Brussels Branch', code: 'BE-BRU',
              meta: { entity: 'SA · BCE 0552.118.004', address: 'Boulevard Reyers 80, Bruxelles' },
              overrides: { invoiceSeq: 'BRU-2026-####', languages: 'French' } },
          ],
        },
        {
          id: 'co-lu', kind: 'country', name: 'Luxembourg', code: 'LU',
          settings: COUNTRY_DEFAULTS.LU,
          children: [
            { id: 'cmp-luxembourg', kind: 'company', name: 'Luxembourg Branch', code: 'LU-LUX',
              meta: { entity: 'S.à r.l · RCS B 188 442', address: 'Route d’Esch 220, Luxembourg' },
              overrides: { invoiceSeq: 'LUX-2026-####' } },
          ],
        },
      ],
    },
    {
      id: 'co-de', kind: 'country', name: 'Germany', code: 'DE',
      settings: COUNTRY_DEFAULTS.DE,
      children: [
        { id: 'cmp-dusseldorf', kind: 'company', name: 'Düsseldorf Branch', code: 'DE-DUS',
          meta: { entity: 'GmbH · HRB 84 192', address: 'Höherweg 270, Düsseldorf' },
          overrides: { invoiceSeq: 'DUS-2026-####', serviceInterval: '30,000 km / 18 months' } },
        { id: 'cmp-hamburg', kind: 'company', name: 'Hamburg Branch', code: 'DE-HAM',
          meta: { entity: 'GmbH · HRB 119 408', address: 'Billstraße 14, Hamburg' },
          overrides: { invoiceSeq: 'HAM-2026-####' } },
      ],
    },
  ],
};

/* Data-sharing model */
export const DATA_SHARING = [
  { type: 'Fleet operators (customers)', mode: 'shared',  note: 'A logistics operator leasing in NL and BE shows in both.' },
  { type: 'Vehicles',                    mode: 'shared',  note: 'Company-owned; visible to authorised cross-company viewers.' },
  { type: 'Contracts',                   mode: 'shared',  note: 'Company-owned, cross-visible to authorised roles.' },
  { type: 'Invoices (sent)',             mode: 'private', note: 'Financial confidentiality — company-private by default.' },
  { type: 'Invoices (received)',         mode: 'private', note: 'Supplier invoices — company-private.' },
  { type: 'Workshop orders',             mode: 'shared',  note: 'Cross-visible when companies share workshops.' },
  { type: 'Pipeline (leads / offers)',   mode: 'private', note: 'Company-private; open up for group-level rollup.' },
  { type: 'User accounts',               mode: 'group',   note: 'Always managed at group level.' },
];

/* ---------- Users ---------- */
export const ADMIN_USERS = [
  { id: 'u-robert', name: 'Robert Mertens', email: 'r.mertens@group.eu', initials: 'RM',
    scopeLabel: 'Group', scopeType: 'group', role: 'Group admin (CEO)', lastSeen: 'Active now', status: 'active',
    secondary: [],
    summary: { can: ['See and edit everything across all countries and companies', 'Configure RBAC, integrations and group structure'], cannot: [] } },
  { id: 'u-lars', name: 'Lars Pieters', email: 'l.pieters@group.eu', initials: 'LP',
    scopeLabel: 'Group', scopeType: 'group', role: 'Finance manager', lastSeen: '12 min ago', status: 'active',
    secondary: [],
    summary: { can: ['See all financial records across the group (read/write)', 'Read all other tracks for context'], cannot: ['Edit operational or workshop records', 'Configure RBAC or integrations'] } },
  { id: 'u-anna', name: 'Anna Kowalska', email: 'a.kowalska@group.eu', initials: 'AK',
    scopeLabel: 'Group', scopeType: 'group', role: 'System integrator', lastSeen: '3 min ago', status: 'active',
    secondary: [],
    summary: { can: ['Add companies, configure integrations and endpoints', 'View sync status and error logs across all companies'], cannot: ['See any business data — contracts, invoices, fleet operator names'] } },
  { id: 'u-eva', name: 'Eva de Vries', email: 'e.devries@group.eu', initials: 'EV',
    scopeLabel: 'Rotterdam Branch', scopeType: 'company', role: 'Sales manager', lastSeen: '1 hour ago', status: 'active',
    secondary: [{ scope: 'Amsterdam Branch', role: 'Sales manager — read only' }],
    summary: { can: ['See and edit all Sales records in Rotterdam', 'Read all Sales records in Amsterdam'], cannot: ['Edit Amsterdam records', 'See Workshop financial fields'] } },
  { id: 'u-markus', name: 'Markus Weber', email: 'm.weber@group.eu', initials: 'MW',
    scopeLabel: 'Düsseldorf + Hamburg', scopeType: 'multi_company', role: 'Sales manager (multi-company)', lastSeen: 'Active now', status: 'active',
    secondary: [],
    summary: { can: ['See and edit Sales records in Düsseldorf and Hamburg'], cannot: ['See records outside Germany', 'See Workshop labor costs'] } },
  { id: 'u-sophie', name: 'Sophie Janssen', email: 's.janssen@group.eu', initials: 'SJ',
    scopeLabel: 'Antwerp Branch', scopeType: 'company', role: 'Sales rep', lastSeen: '4 hours ago', status: 'active',
    secondary: [],
    summary: { can: ['See and edit her own deals in Antwerp', 'Read other reps’ deals in Antwerp'], cannot: ['See contract bank details', 'See Workshop costs'] } },
  { id: 'u-tom', name: 'Tom Janssens', email: 't.janssens@group.eu', initials: 'TJ',
    scopeLabel: 'Benelux region', scopeType: 'region', role: 'Ops coordinator', lastSeen: '38 min ago', status: 'active',
    secondary: [],
    summary: { can: ['See and edit vehicles and service schedules across Benelux', 'Read Workshop records'], cannot: ['See contract values (masked)', 'See customer billing details'] } },
  { id: 'u-hannah', name: 'Hannah Müller', email: 'h.mueller@group.eu', initials: 'HM',
    scopeLabel: 'Düsseldorf Branch', scopeType: 'company', role: 'Workshop lead', lastSeen: '2 hours ago', status: 'active',
    secondary: [],
    summary: { can: ['Edit workshop orders, parts and repair status in Düsseldorf', 'Read related vehicle records'], cannot: ['See contract values or sales pipeline'] } },
  { id: 'u-pieter', name: 'Pieter de Boer', email: 'p.deboer@group.eu', initials: 'PB',
    scopeLabel: 'Rotterdam Branch', scopeType: 'company', role: 'Ops coordinator', lastSeen: '6 days ago', status: 'invited',
    secondary: [],
    summary: { can: ['See and edit vehicles and service schedules in Rotterdam'], cannot: ['See contract values (masked)', 'See customer billing details'] } },
];

export const SCOPE_TYPE_LABEL = {
  group: 'Group', region: 'Region', country: 'Country',
  multi_company: 'Multi-company', company: 'Company', self: 'Self',
};

/* ---------- Roles ---------- */
export const ROLES = [
  { id: 'sales-rep', name: 'Sales rep', system: true, tracks: ['Sales'], users: 1,
    edit: 'Own deals (full) · other reps’ deals read-only', desc: 'Front-line sales. Sees own pipeline; workshop and financial cost fields hidden.' },
  { id: 'sales-mgr', name: 'Sales manager', system: true, tracks: ['Sales', 'Dashboard'], users: 3,
    edit: 'All deals in scope', desc: 'Owns a company or region pipeline. Full edit on Sales, read on dashboard stats.' },
  { id: 'ops-coord', name: 'Ops coordinator', system: true, tracks: ['Operations', 'Workshop (read)'], users: 2,
    edit: 'Vehicles · service schedules', desc: 'Fleet operations. Contract value shown masked; customer billing hidden.' },
  { id: 'workshop-lead', name: 'Workshop lead', system: true, tracks: ['Workshop', 'Operations (read)'], users: 1,
    edit: 'Workshop orders · parts · repair status', desc: 'Runs the workshop. No sales or contract value visibility.' },
  { id: 'bookkeeper', name: 'Bookkeeper', system: true, tracks: ['Finance'], users: 0,
    edit: 'Invoices in/out · payment status', desc: 'Accounts payable / receivable. Sales rep shown as initials only.' },
  { id: 'finance-mgr', name: 'Finance manager', system: true, tracks: ['Finance', 'All (read)'], users: 1,
    edit: 'All financial records in scope', desc: 'Owns finance. Reads every track for context.' },
  { id: 'country-mgr', name: 'Country manager', system: true, tracks: ['All tracks'], users: 0,
    edit: 'All records in country · full on policy', desc: 'Runs a national entity end-to-end.' },
  { id: 'group-admin', name: 'Group admin', system: true, tracks: ['All + system config'], users: 1,
    edit: 'Everything, including RBAC', desc: 'Full control. Can configure the permission system itself.' },
  { id: 'sys-integrator', name: 'System integrator', system: true, tracks: ['Admin pages only'], users: 1,
    edit: 'Integrations · endpoints · environment', desc: 'IT administration with no business-data access. Cannot see contracts, invoices or customer names.' },
  { id: 'portal-user', name: 'Customer portal user', system: true, tracks: ['Customer portal'], users: 0,
    edit: 'Own fleet (read) · messages (write)', desc: 'External fleet operator. Sees only their own fleet; all internal cost data hidden.' },
  { id: 'board-viewer', name: 'Read-only group viewer', system: false, tracks: ['All (read)'], users: 0,
    edit: 'Nothing — view only', desc: 'Custom role. Board member / auditor: consolidated dashboards across the group, no edit, no per-record drill-down outside scope.' },
];

export const FIELD_CATEGORIES = ['Identity', 'Commercial', 'Financial', 'Operational', 'Internal'];

export const DATA_TYPES = [
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

/* Default rule for any field/role not explicitly overridden */
export const DEFAULT_RULE = { visible: true, editable: true, masked: false };

export const FIELD_RULES = {
  'sales-rep': {
    contract: {
      bank_account: { visible: false, editable: false, masked: false, note: 'Bank details — Finance only' },
      margin: { visible: false, editable: false, masked: false, note: 'Margin confidential to management' },
      monthly_fee: { visible: true, editable: false, masked: false },
      contract_value: { visible: true, editable: false, masked: false, note: 'Visible on own deals only' },
      notes_internal: { visible: true, editable: true, masked: false },
    },
    vehicle: {
      lease_value: { visible: false, editable: false, masked: false },
      last_ws_cost: { visible: false, editable: false, masked: false, note: 'Workshop financials confidential to Ops + Finance' },
      maint_cost: { visible: false, editable: false, masked: false, note: 'Workshop financials confidential to Ops + Finance' },
      parts_margin: { visible: false, editable: false, masked: false, note: 'Workshop financials confidential to Ops + Finance' },
    },
    workshop_order: {
      labor_cost: { visible: false, editable: false, masked: false },
      parts_cost: { visible: false, editable: false, masked: false },
      parts_margin: { visible: false, editable: false, masked: false },
    },
  },
  'ops-coord': {
    contract: {
      contract_value: { visible: true, editable: false, masked: true, note: 'Shown as €XXX,XXX' },
      monthly_fee: { visible: true, editable: false, masked: true },
      bank_account: { visible: false, editable: false, masked: false },
      margin: { visible: false, editable: false, masked: false },
      customer_vat: { visible: false, editable: false, masked: false, note: 'Customer billing details hidden' },
    },
  },
  'bookkeeper': {
    contract: {
      sales_rep: { visible: true, editable: false, masked: true, note: 'Shown as initials only' },
      notes_internal: { visible: false, editable: false, masked: false },
    },
    workshop_order: {
      labor_cost: { visible: true, editable: false, masked: false },
      parts_cost: { visible: true, editable: false, masked: false },
    },
  },
  'portal-user': {
    contract: {
      contract_value: { visible: false, editable: false, masked: false },
      monthly_fee: { visible: true, editable: false, masked: false },
      bank_account: { visible: false, editable: false, masked: false },
      margin: { visible: false, editable: false, masked: false },
      sales_rep: { visible: false, editable: false, masked: false, note: 'Internal staff hidden from portal' },
      notes_internal: { visible: false, editable: false, masked: false },
    },
    vehicle: {
      lease_value: { visible: false, editable: false, masked: false },
      last_ws_cost: { visible: false, editable: false, masked: false },
      maint_cost: { visible: false, editable: false, masked: false },
      parts_margin: { visible: false, editable: false, masked: false },
    },
  },
};

/* Sample record values for the live preview pane */
export const SAMPLE_RECORDS = {
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

/* Permission-change audit entries for the RBAC version history */
export const RBAC_VERSIONS = [
  { v: 4, when: 'Today · 09:31', actor: 'Robert Mertens', note: 'Hid workshop financials from Sales rep (Vehicle: last cost, avg maintenance, parts margin)' },
  { v: 3, when: '12 May · 14:08', actor: 'Robert Mertens', note: 'Sales rep — contract value restricted to read-only on own deals' },
  { v: 2, when: '02 Apr · 11:20', actor: 'Anna Kowalska', note: 'Bank account hidden for all non-Finance roles' },
  { v: 1, when: '14 Jan · 08:00', actor: 'System', note: 'Initial template imported · Standard B2B leasing' },
];
