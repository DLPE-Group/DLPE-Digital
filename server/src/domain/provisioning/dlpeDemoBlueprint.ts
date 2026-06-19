/* ============================================================
   dlpeDemoBlueprint — the first PUBLISHED blueprint.
   Captures the full demo dataset from seed.ts so that
   `provisionTenant({ blueprint, inputs: demoInputs, idMode:'literal' })`
   reproduces today's hand-seeded data byte-for-byte.

   Structure:
   - CONFIG sections (orgStructure, roles, fieldRules, tracks,
     entityTypes, crossTriggers, adminUser, users) come from
     the existing seed constants verbatim.
   - RICH DEMO DATA lives in spec.seed:
       - entities: CardSeed[] (4 tracks, 18 pipeline entities)
       - extras.vehicles: VehicleSeed[] (4 portal vehicles)
       - extras.vehicleTimeline: the Brussels drill-down
       - extras.portalFleet: operator + vehicles + invoices
       - extras.integrations: the 9 integration rows
       - extras.audit: the 11 audit entries + cascades
       - extras.reports: the 2 scripted reports
       - extras.dashboard: Markus's default layout
       - extras.rbacVersions: the 4 RBAC version rows
   ============================================================ */

import { STAGE_CONFIG, CROSS_TRIGGERS, DATA_TYPES, SPEC_VERSION, type BlueprintSpec } from '@dlpe/shared';

/* ---- Fixed ids ---- */
export const DEMO_TENANT_ID = 'tenant-dlpe-demo';

/* ---- Org tree (verbatim from seed.ts GROUP_TREE) ---- */
const COUNTRY_DEFAULTS_NL = { vat: '21%', currency: 'EUR', peppol: 'BIS Billing 3.0 · NL profile', languages: 'Dutch', fiscalYear: '1 Jan' };
const COUNTRY_DEFAULTS_BE = { vat: '21%', currency: 'EUR', peppol: 'BIS Billing 3.0 · BE profile', languages: 'Dutch · French', fiscalYear: '1 Jan' };
const COUNTRY_DEFAULTS_LU = { vat: '17%', currency: 'EUR', peppol: 'BIS Billing 3.0 · standard', languages: 'French · German', fiscalYear: '1 Jan' };
const COUNTRY_DEFAULTS_DE = { vat: '19%', currency: 'EUR', peppol: 'BIS Billing 3.0 · DE profile', languages: 'German', fiscalYear: '1 Jan' };

const ORG_TREE: BlueprintSpec['orgStructure'] = {
  id: 'grp', kind: 'group', name: 'Holding group', code: 'GRP',
  meta: { entity: 'Top-level holding · 1 per deployment', address: '—' },
  settings: { serviceInterval: '40,000 km / 24 months', workingHours: '5-day week' },
  children: [
    {
      id: 'reg-benelux', kind: 'region', name: 'Benelux', code: 'BNL',
      meta: { manager: 'Tom Janssens · Regional director' },
      children: [
        {
          id: 'co-nl', kind: 'country', name: 'Netherlands', code: 'NL',
          settings: COUNTRY_DEFAULTS_NL,
          children: [
            { id: 'cmp-rotterdam', kind: 'company', name: 'Rotterdam Branch', code: 'NL-ROT', meta: { entity: 'BV · KvK 24 481 902', address: 'Waalhaven 12, Rotterdam' }, overrides: { invoiceSeq: 'ROT-2026-####' }, children: [] },
            { id: 'cmp-amsterdam', kind: 'company', name: 'Amsterdam Branch', code: 'NL-AMS', meta: { entity: 'BV · KvK 33 902 117', address: 'Westpoort 88, Amsterdam' }, overrides: { invoiceSeq: 'AMS-2026-####' }, children: [] },
          ],
        },
        {
          id: 'co-be', kind: 'country', name: 'Belgium', code: 'BE',
          settings: COUNTRY_DEFAULTS_BE,
          children: [
            { id: 'cmp-antwerp', kind: 'company', name: 'Antwerp Branch', code: 'BE-ANT', meta: { entity: 'NV · BCE 0461.902.331', address: 'Noorderlaan 4, Antwerpen' }, overrides: { invoiceSeq: 'ANT-2026-####', languages: 'Dutch' }, children: [] },
            { id: 'cmp-brussels', kind: 'company', name: 'Brussels Branch', code: 'BE-BRU', meta: { entity: 'SA · BCE 0552.118.004', address: 'Boulevard Reyers 80, Bruxelles' }, overrides: { invoiceSeq: 'BRU-2026-####', languages: 'French' }, children: [] },
          ],
        },
        {
          id: 'co-lu', kind: 'country', name: 'Luxembourg', code: 'LU',
          settings: COUNTRY_DEFAULTS_LU,
          children: [
            { id: 'cmp-luxembourg', kind: 'company', name: 'Luxembourg Branch', code: 'LU-LUX', meta: { entity: 'S.à r.l · RCS B 188 442', address: "Route d'Esch 220, Luxembourg" }, overrides: { invoiceSeq: 'LUX-2026-####' }, children: [] },
          ],
        },
      ],
    },
    {
      id: 'co-de', kind: 'country', name: 'Germany', code: 'DE',
      settings: COUNTRY_DEFAULTS_DE,
      children: [
        { id: 'cmp-dusseldorf', kind: 'company', name: 'Düsseldorf Branch', code: 'DE-DUS', meta: { entity: 'GmbH · HRB 84 192', address: 'Höherweg 270, Düsseldorf' }, overrides: { invoiceSeq: 'DUS-2026-####', serviceInterval: '30,000 km / 18 months' }, children: [] },
        { id: 'cmp-hamburg', kind: 'company', name: 'Hamburg Branch', code: 'DE-HAM', meta: { entity: 'GmbH · HRB 119 408', address: 'Billstraße 14, Hamburg' }, overrides: { invoiceSeq: 'HAM-2026-####' }, children: [] },
      ],
    },
  ],
};

/* ---- Roles (verbatim from seed.ts ROLES) ---- */
const ROLES: BlueprintSpec['roles'] = [
  { id: 'sales-rep', name: 'Sales rep', system: true, tracks: ['Sales'], edit: "Own deals (full) · other reps' deals read-only", desc: 'Front-line sales. Sees own pipeline; workshop and financial cost fields hidden.' },
  { id: 'sales-mgr', name: 'Sales manager', system: true, tracks: ['Sales', 'Dashboard'], edit: 'All deals in scope', desc: 'Owns a company or region pipeline. Full edit on Sales, read on dashboard stats.' },
  { id: 'ops-coord', name: 'Ops coordinator', system: true, tracks: ['Operations', 'Workshop (read)'], edit: 'Vehicles · service schedules', desc: 'Fleet operations. Contract value shown masked; customer billing hidden.' },
  { id: 'workshop-lead', name: 'Workshop lead', system: true, tracks: ['Workshop', 'Operations (read)'], edit: 'Workshop orders · parts · repair status', desc: 'Runs the workshop. No sales or contract value visibility.' },
  { id: 'bookkeeper', name: 'Bookkeeper', system: true, tracks: ['Finance'], edit: 'Invoices in/out · payment status', desc: 'Accounts payable / receivable. Sales rep shown as initials only.' },
  { id: 'finance-mgr', name: 'Finance manager', system: true, tracks: ['Finance', 'All (read)'], edit: 'All financial records in scope', desc: 'Owns finance. Reads every track for context.' },
  { id: 'country-mgr', name: 'Country manager', system: true, tracks: ['All tracks'], edit: 'All records in country · full on policy', desc: 'Runs a national entity end-to-end.' },
  { id: 'group-admin', name: 'Group admin', system: true, tracks: ['All + system config'], edit: 'Everything, including RBAC', desc: 'Full control. Can configure the permission system itself.' },
  { id: 'sys-integrator', name: 'System integrator', system: true, tracks: ['Admin pages only'], edit: 'Integrations · endpoints · environment', desc: 'IT administration with no business-data access. Cannot see contracts, invoices or customer names.' },
  { id: 'portal-user', name: 'Customer portal user', system: true, tracks: ['Customer portal'], edit: 'Own fleet (read) · messages (write)', desc: 'External fleet operator. Sees only their own fleet; all internal cost data hidden.' },
  { id: 'board-viewer', name: 'Read-only group viewer', system: false, tracks: ['All (read)'], edit: 'Nothing — view only', desc: 'Custom role. Board member / auditor: consolidated dashboards across the group, no edit, no per-record drill-down outside scope.' },
];

/* ---- Field rules (flattened from seed.ts FIELD_RULES) ---- */
const FIELD_RULES: BlueprintSpec['fieldRules'] = [
  // sales-rep
  { roleId: 'sales-rep', dataTypeId: 'contract', fieldId: 'bank_account', scope: 'ANY', visible: false, editable: false, masked: false, note: 'Bank details — Finance only' },
  { roleId: 'sales-rep', dataTypeId: 'contract', fieldId: 'margin', scope: 'ANY', visible: false, editable: false, masked: false, note: 'Margin confidential to management' },
  { roleId: 'sales-rep', dataTypeId: 'contract', fieldId: 'monthly_fee', scope: 'ANY', visible: true, editable: false, masked: false },
  { roleId: 'sales-rep', dataTypeId: 'contract', fieldId: 'contract_value', scope: 'ANY', visible: true, editable: false, masked: false, note: 'Visible on own deals only' },
  { roleId: 'sales-rep', dataTypeId: 'contract', fieldId: 'notes_internal', scope: 'ANY', visible: true, editable: true, masked: false },
  { roleId: 'sales-rep', dataTypeId: 'vehicle', fieldId: 'lease_value', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'sales-rep', dataTypeId: 'vehicle', fieldId: 'last_ws_cost', scope: 'ANY', visible: false, editable: false, masked: false, note: 'Workshop financials confidential to Ops + Finance' },
  { roleId: 'sales-rep', dataTypeId: 'vehicle', fieldId: 'maint_cost', scope: 'ANY', visible: false, editable: false, masked: false, note: 'Workshop financials confidential to Ops + Finance' },
  { roleId: 'sales-rep', dataTypeId: 'vehicle', fieldId: 'parts_margin', scope: 'ANY', visible: false, editable: false, masked: false, note: 'Workshop financials confidential to Ops + Finance' },
  { roleId: 'sales-rep', dataTypeId: 'workshop_order', fieldId: 'labor_cost', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'sales-rep', dataTypeId: 'workshop_order', fieldId: 'parts_cost', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'sales-rep', dataTypeId: 'workshop_order', fieldId: 'parts_margin', scope: 'ANY', visible: false, editable: false, masked: false },
  // ops-coord
  { roleId: 'ops-coord', dataTypeId: 'contract', fieldId: 'contract_value', scope: 'ANY', visible: true, editable: false, masked: true, note: 'Shown as €XXX,XXX' },
  { roleId: 'ops-coord', dataTypeId: 'contract', fieldId: 'monthly_fee', scope: 'ANY', visible: true, editable: false, masked: true },
  { roleId: 'ops-coord', dataTypeId: 'contract', fieldId: 'bank_account', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'ops-coord', dataTypeId: 'contract', fieldId: 'margin', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'ops-coord', dataTypeId: 'contract', fieldId: 'customer_vat', scope: 'ANY', visible: false, editable: false, masked: false, note: 'Customer billing details hidden' },
  // bookkeeper
  { roleId: 'bookkeeper', dataTypeId: 'contract', fieldId: 'sales_rep', scope: 'ANY', visible: true, editable: false, masked: true, note: 'Shown as initials only' },
  { roleId: 'bookkeeper', dataTypeId: 'contract', fieldId: 'notes_internal', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'bookkeeper', dataTypeId: 'workshop_order', fieldId: 'labor_cost', scope: 'ANY', visible: true, editable: false, masked: false },
  { roleId: 'bookkeeper', dataTypeId: 'workshop_order', fieldId: 'parts_cost', scope: 'ANY', visible: true, editable: false, masked: false },
  // portal-user
  { roleId: 'portal-user', dataTypeId: 'contract', fieldId: 'contract_value', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'portal-user', dataTypeId: 'contract', fieldId: 'monthly_fee', scope: 'ANY', visible: true, editable: false, masked: false },
  { roleId: 'portal-user', dataTypeId: 'contract', fieldId: 'bank_account', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'portal-user', dataTypeId: 'contract', fieldId: 'margin', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'portal-user', dataTypeId: 'contract', fieldId: 'sales_rep', scope: 'ANY', visible: false, editable: false, masked: false, note: 'Internal staff hidden from portal' },
  { roleId: 'portal-user', dataTypeId: 'contract', fieldId: 'notes_internal', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'portal-user', dataTypeId: 'vehicle', fieldId: 'lease_value', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'portal-user', dataTypeId: 'vehicle', fieldId: 'last_ws_cost', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'portal-user', dataTypeId: 'vehicle', fieldId: 'maint_cost', scope: 'ANY', visible: false, editable: false, masked: false },
  { roleId: 'portal-user', dataTypeId: 'vehicle', fieldId: 'parts_margin', scope: 'ANY', visible: false, editable: false, masked: false },
];

/* ---- Tracks (built from STAGE_CONFIG; meta matches backfill.ts TRACK_META) ---- */
const TRACK_META: Record<string, { label: string; color: string; order: number }> = {
  sales: { label: 'Sales', color: 'var(--track-sales)', order: 0 },
  operations: { label: 'Operations', color: 'var(--track-ops)', order: 1 },
  workshop: { label: 'Workshop', color: 'var(--track-workshop)', order: 2 },
  finance: { label: 'Finance', color: 'var(--track-finance)', order: 3 },
};

const TRACKS: BlueprintSpec['tracks'] = Object.entries(STAGE_CONFIG).map(([key, stages]) => ({
  key,
  label: TRACK_META[key].label,
  color: TRACK_META[key].color,
  order: TRACK_META[key].order,
  builtin: true,
  stages: stages.map((s, i) => ({
    stageId: s.id,
    label: s.label,
    sla: s.sla,
    lock: s.lock ?? undefined,
    cta: s.cta,
    order: i,
  })),
}));

/* ---- Entity types + fields (built from DATA_TYPES + PIPELINE_TYPE mapping) ---- */
const PIPELINE_TYPE: Record<string, { key: string; label: string; trackKey: string }> = {
  sales: { key: 'contract', label: 'Contract', trackKey: 'sales' },
  operations: { key: 'operation', label: 'Operation', trackKey: 'operations' },
  workshop: { key: 'workshop_order', label: 'Workshop order', trackKey: 'workshop' },
  finance: { key: 'invoice', label: 'Invoice', trackKey: 'finance' },
};

const REFERENCE_TYPES = [
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'fleet_operator', label: 'Fleet operator' },
];

const dataKindFor = (cat: string | undefined): string => (cat === 'Financial' ? 'money' : 'text');

const ENTITY_TYPES: BlueprintSpec['entityTypes'] = (() => {
  const types: BlueprintSpec['entityTypes'] = [];
  let order = 0;

  // Pipeline types (one per track)
  for (const [trackKey, ptDef] of Object.entries(PIPELINE_TYPE)) {
    const dt = DATA_TYPES.find((d) => d.id === ptDef.key);
    types.push({
      key: ptDef.key,
      label: ptDef.label,
      kind: 'pipeline',
      trackKey,
      order,
      builtin: true,
      fields: dt ? dt.fields.map((f, i) => ({
        key: f.id,
        label: f.label,
        category: f.cat,
        dataKind: dataKindFor(f.cat),
        order: i,
        builtin: true,
      })) : [],
    });
    order++;
  }

  // Reference types
  for (const rt of REFERENCE_TYPES) {
    const dt = DATA_TYPES.find((d) => d.id === rt.key);
    types.push({
      key: rt.key,
      label: rt.label,
      kind: 'reference',
      order,
      builtin: true,
      fields: dt ? dt.fields.map((f, i) => ({
        key: f.id,
        label: f.label,
        category: f.cat,
        dataKind: dataKindFor(f.cat),
        order: i,
        builtin: true,
      })) : [],
    });
    order++;
  }

  return types;
})();

/* ---- Cross triggers (verbatim from shared) ---- */
const CROSS_TRIGGERS_SPEC: BlueprintSpec['crossTriggers'] = CROSS_TRIGGERS.map((ct) => ({
  whenTrack: ct.whenTrack,
  whenStage: ct.whenStage,
  thenTrack: ct.thenTrack,
  thenStage: ct.thenStage,
  note: ct.note,
}));

/* ---- Admin user (Robert) ---- */
const ADMIN_USER: BlueprintSpec['adminUser'] = {
  idPrefix: 'u-robert',
  name: 'Robert Mertens',
  email: 'r.mertens@group.eu',
  roleId: 'group-admin',
  scopeType: 'group',
  password: 'demo1234',
};

/* ---- Spec users (all 9 ADMIN_USERS; admin deduplication handled by interpreter) ---- */
const SPEC_USERS: NonNullable<BlueprintSpec['users']> = [
  { id: 'u-robert', name: 'Robert Mertens', email: 'r.mertens@group.eu', initials: 'RM', roleId: 'group-admin', scopeType: 'group', scopeLabel: 'Group', scopeNodeId: 'grp', status: 'active', password: 'demo1234', platformAdmin: true, secondary: [] },
  { id: 'u-lars', name: 'Lars Pieters', email: 'l.pieters@group.eu', initials: 'LP', roleId: 'finance-mgr', scopeType: 'group', scopeLabel: 'Group', scopeNodeId: 'grp', status: 'active', password: 'demo1234', secondary: [] },
  { id: 'u-anna', name: 'Anna Kowalska', email: 'a.kowalska@group.eu', initials: 'AK', roleId: 'sys-integrator', scopeType: 'group', scopeLabel: 'Group', scopeNodeId: 'grp', status: 'active', password: 'demo1234', secondary: [] },
  { id: 'u-eva', name: 'Eva de Vries', email: 'e.devries@group.eu', initials: 'EV', roleId: 'sales-mgr', scopeType: 'company', scopeLabel: 'Rotterdam Branch', scopeNodeId: 'cmp-rotterdam', status: 'active', password: 'demo1234', secondary: [{ roleId: 'sales-mgr', scopeType: 'company', scopeLabel: 'Amsterdam Branch', scopeNodeId: 'cmp-amsterdam', roleLabel: 'Sales manager — read only' }] },
  { id: 'u-markus', name: 'Markus Weber', email: 'm.weber@group.eu', initials: 'MW', roleId: 'sales-mgr', scopeType: 'multi_company', scopeLabel: 'Düsseldorf + Hamburg', status: 'active', password: 'demo1234', secondary: [] },
  { id: 'u-sophie', name: 'Sophie Janssen', email: 's.janssen@group.eu', initials: 'SJ', roleId: 'sales-rep', scopeType: 'company', scopeLabel: 'Antwerp Branch', scopeNodeId: 'cmp-antwerp', status: 'active', password: 'demo1234', secondary: [] },
  { id: 'u-tom', name: 'Tom Janssens', email: 't.janssens@group.eu', initials: 'TJ', roleId: 'ops-coord', scopeType: 'region', scopeLabel: 'Benelux region', scopeNodeId: 'reg-benelux', status: 'active', password: 'demo1234', secondary: [] },
  { id: 'u-hannah', name: 'Hannah Müller', email: 'h.mueller@group.eu', initials: 'HM', roleId: 'workshop-lead', scopeType: 'company', scopeLabel: 'Düsseldorf Branch', scopeNodeId: 'cmp-dusseldorf', status: 'active', password: 'demo1234', secondary: [] },
  { id: 'u-pieter', name: 'Pieter de Boer', email: 'p.deboer@group.eu', initials: 'PB', roleId: 'ops-coord', scopeType: 'company', scopeLabel: 'Rotterdam Branch', scopeNodeId: 'cmp-rotterdam', status: 'invited', password: 'demo1234', secondary: [] },
];

/* ---- Company resolver (mirrors seed.ts companyFor) ---- */
function companyFor(customer: string): string {
  const c = customer.toLowerCase();
  if (c.includes('brussels')) return 'cmp-brussels';
  if (c.includes('rotterdam')) return 'cmp-rotterdam';
  if (c.includes('amsterdam')) return 'cmp-amsterdam';
  if (c.includes('antwerp')) return 'cmp-antwerp';
  if (c.includes('luxembourg')) return 'cmp-luxembourg';
  if (c.includes('düsseldorf') || c.includes('dusseldorf')) return 'cmp-dusseldorf';
  if (c.includes('hamburg')) return 'cmp-hamburg';
  if (c.includes('köln') || c.includes('koln') || c.includes('munich') || c.includes('eindhoven')) return 'cmp-dusseldorf';
  return 'cmp-rotterdam';
}

const TRACK_ENUM: Record<string, string> = {
  sales: 'SALES',
  operations: 'OPERATIONS',
  workshop: 'WORKSHOP',
  finance: 'FINANCE',
};

/* ---- Pipeline cards (verbatim from seed.ts card arrays) ---- */
// These are stored in spec.seed.entities as CardSeed-shaped objects.
// The interpreter's seed-writer reconstructs them via cardToEntityCreate.
interface RawCard {
  id: string; customer: string; value?: number; type: string; vehicle?: string;
  sub: string; stageId: string; stageName: string; days: number; daysLabel?: string;
  owner: string; status: string; cta: string; sources: string[]; awaitingSign?: boolean;
}

const SEED_SALES: RawCard[] = [
  { id: 's1', customer: 'Rotterdam Logistics B.V.', value: 1240000, type: 'NEW', sub: '48 vehicles · 4-year FSL', stageId: 'offer', stageName: 'Offer sent', days: 14, owner: 'Eva de Vries', status: 'red', cta: 'Send follow-up', sources: ['CRM'] },
  { id: 's2', customer: 'Hamburg Distribution GmbH', value: 3150000, type: 'RENEWAL', sub: '120 vehicles · expires Q4', stageId: 'contract', stageName: 'Contract', days: 6, owner: 'Markus Weber', status: 'green', cta: 'Mark contract drafted', sources: ['CRM'] },
  { id: 's3', customer: 'Antwerp Retail Group NV', value: 620000, type: 'NEW', sub: '22 vehicles · 3-year FSL', stageId: 'meeting', stageName: 'Meeting', days: 3, owner: 'Sophie Janssen', status: 'green', cta: 'Log qualification', sources: ['CRM'] },
  { id: 's4', customer: 'Eindhoven Construction B.V.', value: 1150000, type: 'RENEWAL', sub: '42 vehicles · expires in 18d', stageId: 'contract', stageName: 'Contract', days: 11, owner: 'Markus Weber', status: 'red', cta: 'Send follow-up', sources: ['CRM'] },
  { id: 's5', customer: 'Brussels Energy SA', value: 2460000, type: 'RENEWAL', sub: '78 vehicles · 5-year FSL', stageId: 'contract', stageName: 'Contract', awaitingSign: true, days: 0, owner: 'Markus Weber', status: 'green', cta: 'Mark contract signed', sources: ['CRM', 'API'] },
];

const SEED_OPS: RawCard[] = [
  { id: 'o2', customer: 'Köln Last Mile', vehicle: 'VAN-4421', type: 'DELIVERY', sub: 'Mercedes Sprinter · order #4421', stageId: 'expected', stageName: 'Expected delivery', days: 3, daysLabel: '3d late', owner: 'Pieter de Boer', status: 'amber', cta: 'Chase supplier', sources: ['API', 'Talend'] },
  { id: 'o3', customer: 'Amsterdam Cold Chain', vehicle: 'TRK-1108', type: 'SERVICE', sub: 'Annual safety inspection due', stageId: 'service_due', stageName: 'Service due 90d', days: 12, daysLabel: 'in 12d', owner: 'Hannah Müller', status: 'amber', cta: 'Plan workshop visit', sources: ['Talend'] },
  { id: 'o4', customer: 'Düsseldorf Bau', vehicle: 'TRK-7702', type: 'WORKSHOP', sub: 'Brake system overhaul', stageId: 'moved', stageName: 'Moved to workshop', days: 2, daysLabel: 'day 2', owner: 'Hannah Müller', status: 'green', cta: 'View workshop order', sources: ['API'] },
  { id: 'o5', customer: 'Rotterdam Logistics', vehicle: 'VAN-3344', type: 'WORKSHOP', sub: 'Ready for collection today', stageId: 'pickup', stageName: 'Ready for pickup', days: 0, daysLabel: 'today', owner: 'Hannah Müller', status: 'green', cta: 'Notify fleet operator', sources: ['API'] },
  { id: 'o6', customer: 'Hamburg Distribution', vehicle: 'TRK-9012', type: 'WORKSHOP', sub: 'Replacement out · 5-day window', stageId: 'replacement', stageName: 'Replacement out', days: 1, daysLabel: 'day 1 of 5', owner: 'Tom Janssens', status: 'green', cta: 'Track loaner', sources: ['API'] },
  { id: 'o7', customer: 'Antwerp Retail Group', vehicle: 'VAN-2210', type: 'SERVICE', sub: 'Inspection proof received', stageId: 'service_due', stageName: 'Service due 90d', days: 47, daysLabel: 'in 47d', owner: 'Tom Janssens', status: 'green', cta: 'Reset next inspection', sources: ['Talend', 'CSV'] },
];

const SEED_WORKSHOP: RawCard[] = [
  { id: 'w1', customer: 'Düsseldorf Bau', vehicle: 'TRK-7702', type: 'WORKSHOP', sub: 'Brake pads + rotors ordered', stageId: 'parts', stageName: 'Order parts', days: 1, daysLabel: 'ETA 2d', owner: 'Lars Pieters', status: 'green', cta: 'Confirm parts arrival', sources: ['API'] },
  { id: 'w2', customer: 'Rotterdam Logistics', vehicle: 'VAN-3344', type: 'WORKSHOP', sub: 'Repair complete · awaiting pickup', stageId: 'released', stageName: 'Ready for pickup', days: 0, daysLabel: 'today', owner: 'Lars Pieters', status: 'green', cta: 'Notify fleet operator', sources: ['API'] },
  { id: 'w3', customer: 'Antwerp Retail', vehicle: 'TRK-5520', type: 'WORKSHOP', sub: 'Parts delivered · in repair', stageId: 'in_repair', stageName: 'In repair', days: 1, daysLabel: 'day 1 of 3', owner: 'Lars Pieters', status: 'green', cta: 'Update progress', sources: ['API'] },
  { id: 'w4', customer: 'Köln Last Mile', vehicle: 'VAN-8801', type: 'SUPPLIER', sub: 'PEPPOL invoice received', value: 1240, stageId: 'invoice_in', stageName: 'Invoice received', days: 0, daysLabel: 'today', owner: 'Lars Pieters', status: 'green', cta: 'Approve & send to Finance', sources: ['PEPPOL'] },
];

const SEED_FINANCE: RawCard[] = [
  { id: 'f2', customer: 'Munich Foods Logistics GmbH', value: 94000, type: 'INVOICE', sub: 'Invoice MFL-2024-1187', stageId: 'overdue', stageName: 'Overdue', days: 31, daysLabel: '31d overdue', owner: 'Ines Vandeput', status: 'red', cta: 'Send dunning notice', sources: ['PEPPOL'] },
  { id: 'f3', customer: 'Luxembourg Distribution S.à.r.l.', value: 185000, type: 'INVOICE', sub: 'Invoice LXD-2024-0912', stageId: 'awaiting', stageName: 'Awaiting payment', days: 12, daysLabel: 'in 18d', owner: 'Ines Vandeput', status: 'amber', cta: 'Send reminder', sources: ['PEPPOL'] },
  { id: 'f4', customer: 'Supplier · MAN Trucks AG', value: 87500, type: 'SUPPLIER', sub: 'PEPPOL invoice · 12 vehicles', stageId: 'supplier', stageName: 'Supplier invoice', days: 1, daysLabel: 'received 1d ago', owner: 'Ines Vandeput', status: 'green', cta: 'Approve for payment', sources: ['PEPPOL'] },
];

// Flatten cards to CardSeed shape with track enum
function toCardSeeds(arr: RawCard[], trackKey: string): Array<Record<string, unknown>> {
  return arr.map((c) => ({
    id: c.id,
    companyId: companyFor(c.customer),
    track: TRACK_ENUM[trackKey],
    type: c.type,
    customer: c.customer,
    value: c.value ?? null,
    vehicle: c.vehicle ?? null,
    sub: c.sub,
    stageId: c.stageId,
    stageName: c.stageName,
    days: c.days,
    daysLabel: c.daysLabel ?? null,
    owner: c.owner,
    status: c.status,
    cta: c.cta,
    sources: c.sources,
    awaitingSign: c.awaitingSign ?? false,
  }));
}

const CARD_ENTITIES = [
  ...toCardSeeds(SEED_SALES, 'sales'),
  ...toCardSeeds(SEED_OPS, 'operations'),
  ...toCardSeeds(SEED_WORKSHOP, 'workshop'),
  ...toCardSeeds(SEED_FINANCE, 'finance'),
];

/* ---- Vehicle timeline ---- */
const VEHICLE_TIMELINE = {
  customer: 'Brussels Energy SA',
  vehicle: 'Fleet · 78 vehicles · master agreement BES-2026-04',
  contractValue: 2460000,
  account: 'Markus Weber',
  events: [
    { track: 'sales', stage: 'Lead created', detail: 'Inbound from Salesforce — RFP for fleet refresh', date: 'Feb 04 · 2026', owner: 'Markus Weber', state: 'done', docs: [] },
    { track: 'sales', stage: 'Qualification meeting', detail: 'On-site visit · Brussels HQ', date: 'Feb 19 · 2026', owner: 'Markus Weber', state: 'done', docs: ['Meeting notes'] },
    { track: 'sales', stage: 'Offer sent', detail: '5-year full-service lease · 78 vehicles', date: 'Mar 11 · 2026', owner: 'Markus Weber', state: 'done', docs: ['Offer letter v3.pdf'] },
    { track: 'sales', stage: 'Offer signed', detail: 'Counter-signed digitally · Adobe Sign', date: 'May 18 · 2026', owner: 'Brussels Energy', state: 'done', docs: ['Signed offer.pdf'] },
    { track: 'sales', stage: 'Contract drafted', detail: 'Awaiting final signature — country-level addenda included', date: 'May 26 · 2026', owner: 'Markus Weber', state: 'active', docs: ['Contract draft v2.pdf'] },
    { track: 'operations', stage: 'Vehicle order created', detail: 'Auto-triggers on Sales signature', date: 'Pending', owner: 'Tom Janssens', state: 'future', docs: [] },
    { track: 'operations', stage: 'Expected delivery', detail: '90 days from order — supplier confirmation required', date: 'T+90d', owner: 'Tom Janssens', state: 'future', docs: [] },
    { track: 'finance', stage: 'Invoice cycle begins', detail: 'Recurring monthly invoicing for 60 months', date: 'On first delivery', owner: 'Ines Vandeput', state: 'future', docs: [] },
  ],
};

/* ---- Portal fleet ---- */
const PORTAL_FLEET = {
  operator: 'Rotterdam Logistics B.V.',
  contact: 'Lieke van der Meer · Fleet manager',
  vehicles: [
    { plate: 'VAN-3344', model: 'Mercedes Sprinter 314', status: 'busy', statusLabel: 'In workshop', note: 'Replacement vehicle delivered · returns in 2 days', companyId: companyFor('Rotterdam Logistics B.V.') },
    { plate: 'TRK-9012', model: 'MAN TGS 26.420', status: 'ok', statusLabel: 'In fleet', note: 'Next service in 47 days', companyId: companyFor('Rotterdam Logistics B.V.') },
    { plate: 'VAN-5571', model: 'Ford Transit Custom', status: 'warn', statusLabel: 'Service due', note: 'Annual inspection in 21 days', companyId: companyFor('Rotterdam Logistics B.V.') },
    { plate: 'TRK-2284', model: 'Volvo FH 460', status: 'busy', statusLabel: 'Awaiting delivery', note: 'Expected Jun 18 — order confirmed by supplier', companyId: companyFor('Rotterdam Logistics B.V.') },
  ],
  invoices: [
    { ref: 'INV-2026-04812', value: 18420, due: 'Due in 14 days', status: 'ok' },
    { ref: 'INV-2026-04501', value: 12090, due: '31 days overdue', status: 'late' },
  ],
  operatorCompanyId: companyFor('Rotterdam Logistics B.V.'),
};

/* ---- Additional fleet operators (non-portal) ---- */
const FLEET_OPERATORS = [
  {
    name: 'Düsseldorf Bau B.V.',
    contact: 'J. Bakker',
    companyId: 'cmp-dusseldorf',
    meta: { vat: 'DE 811 204 119', creditLimit: '€2,000,000' },
  },
];

/* ---- Integrations ---- */
const INTEGRATIONS = [
  { id: 'sf', name: 'Salesforce CRM', kind: 'CRM · inbound leads & deal sync', direction: 'inbound', logo: 'SF', status: 'healthy', lastSync: '2 min ago', throughput: '124 leads / day · 38 deals updated', latency: 'p95 · 280 ms', desc: 'Inbound leads land in the Sales track. Deal stage and contact updates flow both ways for active opportunities.' },
  { id: 'peppol-in', name: 'PEPPOL inbox', kind: 'E-invoicing · AP-NL-002', direction: 'inbound', logo: 'PEP', status: 'healthy', lastSync: '14 min ago', throughput: '23 invoices / day · 412 / month', latency: 'real-time · webhook', desc: 'Supplier e-invoices arrive here. Auto-matched against purchase order + goods receipt before they reach the workshop or finance.' },
  { id: 'man-api', name: 'MAN Trucks AG', kind: 'Supplier API · order status', direction: 'inbound', logo: 'MAN', status: 'degraded', lastSync: '47 min ago', throughput: '12 order updates / day', latency: 'p95 · 4.2 s · elevated', desc: 'Order status, expected delivery dates, build configuration confirmations for MAN commercial vehicles.' },
  { id: 'merc-api', name: 'Mercedes-Benz Trucks', kind: 'Supplier API · order status', direction: 'inbound', logo: 'MB', status: 'healthy', lastSync: '3 min ago', throughput: '18 order updates / day', latency: 'p95 · 410 ms', desc: 'Order and delivery confirmations from Mercedes-Benz commercial vehicles.' },
  { id: 'bosch-api', name: 'Bosch Mobility', kind: 'Supplier API · parts catalogue', direction: 'inbound', logo: 'BSH', status: 'healthy', lastSync: '8 min ago', throughput: '142 parts / day', latency: 'p95 · 520 ms', desc: 'Parts catalogue, lead times and order confirmations for own-workshop repairs.' },
  { id: 'talend', name: 'Talend ETL', kind: 'Data pipeline · bi-directional', direction: 'bi', logo: 'TLD', status: 'healthy', lastSync: '12 min ago', throughput: '1,240 records / sync · every 15 min', latency: 'batch · 15 min', desc: 'Cross-system data normalisation. Powers the unified DataSource abstraction the entire dashboard reads from.' },
  { id: 'peppol-out', name: 'PEPPOL access point', kind: 'E-invoicing · outbound', direction: 'outbound', logo: 'PEP', status: 'healthy', lastSync: '1 hour ago', throughput: '187 invoices / month', latency: 'real-time', desc: 'Outbound customer invoices to fleet operators registered on the PEPPOL network.' },
  { id: 'fin-sys', name: 'Exact Online', kind: 'Accounting · bi-directional', direction: 'bi', logo: 'EX', status: 'healthy', lastSync: '5 min ago', throughput: '210 entries / day', latency: 'p95 · 740 ms', desc: 'General ledger entries, payment confirmations, supplier payment scheduling.' },
  { id: 'csv-bulk', name: 'Bulk CSV upload', kind: 'Manual import', direction: 'inbound', logo: 'CSV', status: 'idle', lastSync: '3 days ago', throughput: '0 imports today', latency: 'on-demand', desc: 'Fallback for systems without API access. Used for legacy CRM exports and one-off data loads.' },
];

/* ---- Audit ---- */
const AUDIT = [
  { day: 'Today · 28 May', time: '09:14', actor: 'Markus Weber', actorRole: 'Account Director', verb: 'marked contract signed', target: 'Brussels Energy SA · €2.46M renewal', track: 'sales', kind: 'critical', icon: 'bolt', isSystem: false, cascades: [{ track: 'operations', text: 'Created card · "Vehicle ordered · 78 vehicles"' }, { track: 'finance', text: 'Created card · "Invoice to create · €2.46M"' }, { track: 'sales', text: 'Customer portal updated · order confirmed' }] },
  { day: 'Today · 28 May', time: '08:47', actor: 'System · Talend', actorRole: 'Automated ETL · 15-min cadence', verb: 'sync completed', target: '1,240 records across 6 sources', track: 'workshop', kind: 'info', icon: 'refresh', isSystem: true, cascades: [] },
  { day: 'Today · 28 May', time: '08:22', actor: 'Tom Janssens', actorRole: 'Fleet Operations', verb: 'confirmed delivery date', target: 'Köln Last Mile · VAN-4421 · slipped to Jun 04', track: 'operations', kind: 'normal', icon: 'truck', isSystem: false, cascades: [] },
  { day: 'Today · 28 May', time: '07:55', actor: 'System · PEPPOL', actorRole: 'Inbound webhook', verb: 'invoice received', target: 'Bosch Mobility · €1,240 · matched to WO-2026-118', track: 'workshop', kind: 'info', icon: 'receipt', isSystem: true, cascades: [] },
  { day: 'Yesterday · 27 May', time: '16:32', actor: 'Eva de Vries', actorRole: 'Account Manager · Benelux', verb: 'sent follow-up email', target: 'Rotterdam Logistics B.V. · €1.24M offer (gentle nudge)', track: 'sales', kind: 'normal', icon: 'mail', isSystem: false, cascades: [] },
  { day: 'Yesterday · 27 May', time: '14:18', actor: 'Hannah Müller', actorRole: 'Service Coordinator', verb: 'scheduled workshop visit', target: 'Amsterdam Cold Chain · TRK-1108 · 4 Jun', track: 'operations', kind: 'normal', icon: 'flash', isSystem: false, cascades: [{ track: 'workshop', text: 'New work order WO-2026-119 · expected 4 Jun' }, { track: 'operations', text: 'Replacement vehicle VAN-7811 reserved' }] },
  { day: 'Yesterday · 27 May', time: '11:04', actor: 'Ines Vandeput', actorRole: 'Accounts Payable', verb: 'approved PEPPOL invoice', target: 'MAN Trucks AG · €87,500 · payment scheduled 27 Jun', track: 'finance', kind: 'normal', icon: 'receipt', isSystem: false, cascades: [] },
  { day: 'Yesterday · 27 May', time: '10:21', actor: 'System · Salesforce', actorRole: 'Inbound CRM sync', verb: 'imported new lead', target: 'Antwerp Retail Group NV · 22 vehicles · 3-year FSL', track: 'sales', kind: 'info', icon: 'plus', isSystem: true, cascades: [] },
  { day: 'Earlier this week', time: 'May 26 · 15:50', actor: 'Sophie Janssen', actorRole: 'Account Manager · Benelux', verb: 'logged qualification meeting', target: 'Antwerp Retail Group NV', track: 'sales', kind: 'normal', icon: 'check', isSystem: false, cascades: [] },
  { day: 'Earlier this week', time: 'May 25 · 09:33', actor: 'Lars Pieters', actorRole: 'Workshop Manager', verb: 'released for pickup', target: 'Rotterdam Logistics · VAN-3344 · brake-system overhaul', track: 'workshop', kind: 'normal', icon: 'check', isSystem: false, cascades: [] },
  { day: 'Earlier this week', time: 'May 25 · 08:18', actor: 'System · MAN API', actorRole: 'Supplier API', verb: 'flagged order overdue', target: 'Köln Last Mile · VAN-4421 · 3 days late', track: 'operations', kind: 'warning', icon: 'bolt', isSystem: true, cascades: [] },
];

/* ---- Reports ---- */
function scriptedProse(scope: string[]): { headline: string; tracks: Record<string, string> } {
  const tracks: Record<string, string> = {};
  if (scope.includes('sales')) tracks.sales = 'Open pipeline stands at €8.62M across 5 deals. €2.39M is at risk across red deals needing follow-up, while three deals sit in contract — led by the Brussels Energy renewal awaiting signature.';
  if (scope.includes('operations')) tracks.operations = '6 vehicles are active in the flow. One delivery is running late and two vehicles are due for service; the remainder are on track.';
  if (scope.includes('workshop')) tracks.workshop = '4 work orders are open — one in repair, one released and ready for pickup, and a Bosch PEPPOL invoice awaiting approval.';
  if (scope.includes('finance')) tracks.finance = '€279k in receivables outstanding, of which €94k is 31+ days overdue. A supplier invoice is queued for payment.';
  const headline = 'Operations across the fleet are steady. Open pipeline of €8.62M with €279k in receivables. Key risks: €2.39M of at-risk deals and a €94k overdue invoice. Operations are largely on track with one late delivery.';
  return { headline, tracks };
}

const REPORTS = [
  { title: 'Weekly fleet summary', spec: { title: 'Weekly fleet summary', prompt: 'Weekly fleet summary', period: 'This week', format: 'Executive brief', scope: ['sales', 'operations', 'workshop', 'finance'] }, when: 'May 26 · 08:40', prose: scriptedProse(['sales', 'operations', 'workshop', 'finance']), createdById: 'u-markus' },
  { title: 'Q2 cashflow & receivables', spec: { title: 'Q2 cashflow & receivables', prompt: 'Cashflow and receivables review', period: 'This quarter', format: 'Detailed breakdown', scope: ['finance'] }, when: 'May 22 · 16:12', prose: scriptedProse(['finance']), createdById: 'u-markus' },
];

/* ---- Dashboard ---- */
const DASHBOARD_CHARTS = [
  { id: 'd1', metricId: 'pipeline', type: 'stat', title: 'Open pipeline' },
  { id: 'd2', metricId: 'atRisk', type: 'stat', title: 'At-risk pipeline' },
  { id: 'd3', metricId: 'wonThisWeek', type: 'stat', title: 'Closed-won this week' },
  { id: 'd4', metricId: 'pipelineStage', type: 'bar', title: 'Pipeline by stage' },
  { id: 'd5', metricId: 'ontime', type: 'donut', title: 'On-time delivery' },
  { id: 'd6', metricId: 'openByTrack', type: 'bar', title: 'Open items by track' },
];

/* ---- RBAC versions ---- */
const RBAC_VERSIONS = [
  { v: 4, when: 'Today · 09:31', actor: 'Robert Mertens', note: 'Hid workshop financials from Sales rep (Vehicle: last cost, avg maintenance, parts margin)' },
  { v: 3, when: '12 May · 14:08', actor: 'Robert Mertens', note: 'Sales rep — contract value restricted to read-only on own deals' },
  { v: 2, when: '02 Apr · 11:20', actor: 'Anna Kowalska', note: 'Bank account hidden for all non-Finance roles' },
  { v: 1, when: '14 Jan · 08:00', actor: 'System', note: 'Initial template imported · Standard B2B leasing' },
];

/* ============================================================
   Assemble the BlueprintSpec
   ============================================================ */
export const dlpeDemoBlueprint = {
  key: 'dlpe-demo' as const,
  name: 'DLPE Demo',
  spec: {
    specVersion: SPEC_VERSION,
    inputs: [
      { key: 'slug', label: 'Tenant slug', type: 'string' as const, required: true },
      { key: 'customerName', label: 'Customer name', type: 'string' as const, required: true },
      { key: 'region', label: 'Region', type: 'region' as const, required: false },
    ],
    orgStructure: ORG_TREE,
    roles: ROLES,
    fieldRules: FIELD_RULES,
    tracks: TRACKS,
    entityTypes: ENTITY_TYPES,
    crossTriggers: CROSS_TRIGGERS_SPEC,
    adminUser: ADMIN_USER,
    users: SPEC_USERS,
    seed: {
      // Pipeline entities stored as CardSeed-shaped objects.
      // The seed-writer in provisionTenant.ts reconstructs them via cardToEntityCreate.
      entities: CARD_ENTITIES,
      // Rich demo data — written by the extended seed-writer
      extras: {
        vehicleTimeline: VEHICLE_TIMELINE,
        portalFleet: PORTAL_FLEET,
        fleetOperators: FLEET_OPERATORS,
        integrations: INTEGRATIONS,
        audit: AUDIT,
        reports: REPORTS,
        dashboard: { userId: 'u-markus', charts: DASHBOARD_CHARTS },
        rbacVersions: RBAC_VERSIONS,
      },
    },
  } satisfies BlueprintSpec,
};

/* ---- Runtime inputs for provisioning the demo ---- */
export const demoInputs: Record<string, unknown> = {
  slug: 'dlpe-demo',
  customerName: 'DLPE Demo',
  region: 'eu',
};
