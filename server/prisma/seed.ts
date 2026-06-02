/* ============================================================
   Intelligence Layer — Phase 1 seed.
   Reproduces today's frontend mock (app/src/{data.js,admin_data.js,
   editors.jsx,views_part1.jsx,reports.jsx,dashboard.jsx}) so the app
   is byte-identical on first run, but now persisted in Postgres.

   Idempotent: wipes the seeded tables (deleteMany) then re-creates.
   NOTE: cards o1 / f1 are NOT seeded — they only appear after the
   Brussels cascade. s5 seeds awaitingSign:true, stageId:'contract'.
   ============================================================ */

import { PrismaClient, Prisma } from '@prisma/client';
import argon2 from 'argon2';
import {
  STAGE_CONFIG,
  CROSS_TRIGGERS,
  DATA_TYPES,
  FIELD_CATEGORIES,
} from '@dlpe/shared';
import { seedMetaModel, cardToEntityCreate, vehicleToEntityCreate, type CardSeed } from '../src/domain/backfill.js';

const prisma = new PrismaClient();

const TRACK_ENUM: Record<string, string> = {
  sales: 'SALES',
  operations: 'OPERATIONS',
  workshop: 'WORKSHOP',
  finance: 'FINANCE',
};

/* ---------------- Org tree (GROUP_TREE) ---------------- */
const COUNTRY_DEFAULTS = {
  NL: { vat: '21%', currency: 'EUR', peppol: 'BIS Billing 3.0 · NL profile', languages: 'Dutch', fiscalYear: '1 Jan' },
  BE: { vat: '21%', currency: 'EUR', peppol: 'BIS Billing 3.0 · BE profile', languages: 'Dutch · French', fiscalYear: '1 Jan' },
  LU: { vat: '17%', currency: 'EUR', peppol: 'BIS Billing 3.0 · standard', languages: 'French · German', fiscalYear: '1 Jan' },
  DE: { vat: '19%', currency: 'EUR', peppol: 'BIS Billing 3.0 · DE profile', languages: 'German', fiscalYear: '1 Jan' },
};

interface RawNode {
  id: string;
  kind: string;
  name: string;
  code?: string;
  meta?: unknown;
  settings?: unknown;
  overrides?: unknown;
  children?: RawNode[];
}

const GROUP_TREE: RawNode = {
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
          settings: COUNTRY_DEFAULTS.NL,
          children: [
            { id: 'cmp-rotterdam', kind: 'company', name: 'Rotterdam Branch', code: 'NL-ROT', meta: { entity: 'BV · KvK 24 481 902', address: 'Waalhaven 12, Rotterdam' }, overrides: { invoiceSeq: 'ROT-2026-####' } },
            { id: 'cmp-amsterdam', kind: 'company', name: 'Amsterdam Branch', code: 'NL-AMS', meta: { entity: 'BV · KvK 33 902 117', address: 'Westpoort 88, Amsterdam' }, overrides: { invoiceSeq: 'AMS-2026-####' } },
          ],
        },
        {
          id: 'co-be', kind: 'country', name: 'Belgium', code: 'BE',
          settings: COUNTRY_DEFAULTS.BE,
          children: [
            { id: 'cmp-antwerp', kind: 'company', name: 'Antwerp Branch', code: 'BE-ANT', meta: { entity: 'NV · BCE 0461.902.331', address: 'Noorderlaan 4, Antwerpen' }, overrides: { invoiceSeq: 'ANT-2026-####', languages: 'Dutch' } },
            { id: 'cmp-brussels', kind: 'company', name: 'Brussels Branch', code: 'BE-BRU', meta: { entity: 'SA · BCE 0552.118.004', address: 'Boulevard Reyers 80, Bruxelles' }, overrides: { invoiceSeq: 'BRU-2026-####', languages: 'French' } },
          ],
        },
        {
          id: 'co-lu', kind: 'country', name: 'Luxembourg', code: 'LU',
          settings: COUNTRY_DEFAULTS.LU,
          children: [
            { id: 'cmp-luxembourg', kind: 'company', name: 'Luxembourg Branch', code: 'LU-LUX', meta: { entity: 'S.à r.l · RCS B 188 442', address: 'Route d’Esch 220, Luxembourg' }, overrides: { invoiceSeq: 'LUX-2026-####' } },
          ],
        },
      ],
    },
    {
      id: 'co-de', kind: 'country', name: 'Germany', code: 'DE',
      settings: COUNTRY_DEFAULTS.DE,
      children: [
        { id: 'cmp-dusseldorf', kind: 'company', name: 'Düsseldorf Branch', code: 'DE-DUS', meta: { entity: 'GmbH · HRB 84 192', address: 'Höherweg 270, Düsseldorf' }, overrides: { invoiceSeq: 'DUS-2026-####', serviceInterval: '30,000 km / 18 months' } },
        { id: 'cmp-hamburg', kind: 'company', name: 'Hamburg Branch', code: 'DE-HAM', meta: { entity: 'GmbH · HRB 119 408', address: 'Billstraße 14, Hamburg' }, overrides: { invoiceSeq: 'HAM-2026-####' } },
      ],
    },
  ],
};

const ORG_KIND: Record<string, Prisma.OrgNodeCreateManyInput['kind']> = {
  group: 'GROUP', region: 'REGION', country: 'COUNTRY', company: 'COMPANY',
};

function flattenTree(node: RawNode, parentId: string | null, out: Prisma.OrgNodeCreateManyInput[]) {
  out.push({
    id: node.id,
    kind: ORG_KIND[node.kind],
    name: node.name,
    code: node.code ?? null,
    meta: (node.meta as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    settings: (node.settings as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    overrides: (node.overrides as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    parentId,
  });
  (node.children ?? []).forEach((c) => flattenTree(c, node.id, out));
}

/* ---------------- Roles ---------------- */
const ROLES = [
  { id: 'sales-rep', name: 'Sales rep', system: true, tracks: ['Sales'], users: 1, edit: 'Own deals (full) · other reps’ deals read-only', desc: 'Front-line sales. Sees own pipeline; workshop and financial cost fields hidden.' },
  { id: 'sales-mgr', name: 'Sales manager', system: true, tracks: ['Sales', 'Dashboard'], users: 3, edit: 'All deals in scope', desc: 'Owns a company or region pipeline. Full edit on Sales, read on dashboard stats.' },
  { id: 'ops-coord', name: 'Ops coordinator', system: true, tracks: ['Operations', 'Workshop (read)'], users: 2, edit: 'Vehicles · service schedules', desc: 'Fleet operations. Contract value shown masked; customer billing hidden.' },
  { id: 'workshop-lead', name: 'Workshop lead', system: true, tracks: ['Workshop', 'Operations (read)'], users: 1, edit: 'Workshop orders · parts · repair status', desc: 'Runs the workshop. No sales or contract value visibility.' },
  { id: 'bookkeeper', name: 'Bookkeeper', system: true, tracks: ['Finance'], users: 0, edit: 'Invoices in/out · payment status', desc: 'Accounts payable / receivable. Sales rep shown as initials only.' },
  { id: 'finance-mgr', name: 'Finance manager', system: true, tracks: ['Finance', 'All (read)'], users: 1, edit: 'All financial records in scope', desc: 'Owns finance. Reads every track for context.' },
  { id: 'country-mgr', name: 'Country manager', system: true, tracks: ['All tracks'], users: 0, edit: 'All records in country · full on policy', desc: 'Runs a national entity end-to-end.' },
  { id: 'group-admin', name: 'Group admin', system: true, tracks: ['All + system config'], users: 1, edit: 'Everything, including RBAC', desc: 'Full control. Can configure the permission system itself.' },
  { id: 'sys-integrator', name: 'System integrator', system: true, tracks: ['Admin pages only'], users: 1, edit: 'Integrations · endpoints · environment', desc: 'IT administration with no business-data access. Cannot see contracts, invoices or customer names.' },
  { id: 'portal-user', name: 'Customer portal user', system: true, tracks: ['Customer portal'], users: 0, edit: 'Own fleet (read) · messages (write)', desc: 'External fleet operator. Sees only their own fleet; all internal cost data hidden.' },
  { id: 'board-viewer', name: 'Read-only group viewer', system: false, tracks: ['All (read)'], users: 0, edit: 'Nothing — view only', desc: 'Custom role. Board member / auditor: consolidated dashboards across the group, no edit, no per-record drill-down outside scope.' },
];

// Map ADMIN_USERS role strings -> Role id.
const ROLE_NAME_TO_ID: Record<string, string> = {
  'Group admin (CEO)': 'group-admin',
  'Finance manager': 'finance-mgr',
  'System integrator': 'sys-integrator',
  'Sales manager': 'sales-mgr',
  'Sales manager (multi-company)': 'sales-mgr',
  'Sales manager — read only': 'sales-mgr',
  'Sales rep': 'sales-rep',
  'Ops coordinator': 'ops-coord',
  'Workshop lead': 'workshop-lead',
  'Bookkeeper': 'bookkeeper',
};

// Map a scopeLabel -> OrgNode id (best effort; null falls back to scopeLabel).
const SCOPE_LABEL_TO_NODE: Record<string, string> = {
  'Group': 'grp',
  'Rotterdam Branch': 'cmp-rotterdam',
  'Amsterdam Branch': 'cmp-amsterdam',
  'Antwerp Branch': 'cmp-antwerp',
  'Brussels Branch': 'cmp-brussels',
  'Luxembourg Branch': 'cmp-luxembourg',
  'Düsseldorf Branch': 'cmp-dusseldorf',
  'Hamburg Branch': 'cmp-hamburg',
  'Benelux region': 'reg-benelux',
};

/* ---------------- Users ---------------- */
interface RawUser {
  id: string; name: string; email: string; initials: string;
  scopeLabel: string; scopeType: string; role: string; lastSeen: string; status: string;
  secondary: { scope: string; role: string }[];
}

const ADMIN_USERS: RawUser[] = [
  { id: 'u-robert', name: 'Robert Mertens', email: 'r.mertens@group.eu', initials: 'RM', scopeLabel: 'Group', scopeType: 'group', role: 'Group admin (CEO)', lastSeen: 'Active now', status: 'active', secondary: [] },
  { id: 'u-lars', name: 'Lars Pieters', email: 'l.pieters@group.eu', initials: 'LP', scopeLabel: 'Group', scopeType: 'group', role: 'Finance manager', lastSeen: '12 min ago', status: 'active', secondary: [] },
  { id: 'u-anna', name: 'Anna Kowalska', email: 'a.kowalska@group.eu', initials: 'AK', scopeLabel: 'Group', scopeType: 'group', role: 'System integrator', lastSeen: '3 min ago', status: 'active', secondary: [] },
  { id: 'u-eva', name: 'Eva de Vries', email: 'e.devries@group.eu', initials: 'EV', scopeLabel: 'Rotterdam Branch', scopeType: 'company', role: 'Sales manager', lastSeen: '1 hour ago', status: 'active', secondary: [{ scope: 'Amsterdam Branch', role: 'Sales manager — read only' }] },
  { id: 'u-markus', name: 'Markus Weber', email: 'm.weber@group.eu', initials: 'MW', scopeLabel: 'Düsseldorf + Hamburg', scopeType: 'multi_company', role: 'Sales manager (multi-company)', lastSeen: 'Active now', status: 'active', secondary: [] },
  { id: 'u-sophie', name: 'Sophie Janssen', email: 's.janssen@group.eu', initials: 'SJ', scopeLabel: 'Antwerp Branch', scopeType: 'company', role: 'Sales rep', lastSeen: '4 hours ago', status: 'active', secondary: [] },
  { id: 'u-tom', name: 'Tom Janssens', email: 't.janssens@group.eu', initials: 'TJ', scopeLabel: 'Benelux region', scopeType: 'region', role: 'Ops coordinator', lastSeen: '38 min ago', status: 'active', secondary: [] },
  { id: 'u-hannah', name: 'Hannah Müller', email: 'h.mueller@group.eu', initials: 'HM', scopeLabel: 'Düsseldorf Branch', scopeType: 'company', role: 'Workshop lead', lastSeen: '2 hours ago', status: 'active', secondary: [] },
  { id: 'u-pieter', name: 'Pieter de Boer', email: 'p.deboer@group.eu', initials: 'PB', scopeLabel: 'Rotterdam Branch', scopeType: 'company', role: 'Ops coordinator', lastSeen: '6 days ago', status: 'invited', secondary: [] },
];

/* ---------------- Data sharing ---------------- */
const DATA_SHARING = [
  { type: 'Fleet operators (customers)', mode: 'shared', note: 'A logistics operator leasing in NL and BE shows in both.' },
  { type: 'Vehicles', mode: 'shared', note: 'Company-owned; visible to authorised cross-company viewers.' },
  { type: 'Contracts', mode: 'shared', note: 'Company-owned, cross-visible to authorised roles.' },
  { type: 'Invoices (sent)', mode: 'private', note: 'Financial confidentiality — company-private by default.' },
  { type: 'Invoices (received)', mode: 'private', note: 'Supplier invoices — company-private.' },
  { type: 'Workshop orders', mode: 'shared', note: 'Cross-visible when companies share workshops.' },
  { type: 'Pipeline (leads / offers)', mode: 'private', note: 'Company-private; open up for group-level rollup.' },
  { type: 'User accounts', mode: 'group', note: 'Always managed at group level.' },
] as const;

/* ---------------- Field rules (diffs from DEFAULT_RULE) ---------------- */
const FIELD_RULES: Record<string, Record<string, Record<string, { visible: boolean; editable: boolean; masked: boolean; note?: string }>>> = {
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

const RBAC_VERSIONS = [
  { v: 4, when: 'Today · 09:31', actor: 'Robert Mertens', note: 'Hid workshop financials from Sales rep (Vehicle: last cost, avg maintenance, parts margin)' },
  { v: 3, when: '12 May · 14:08', actor: 'Robert Mertens', note: 'Sales rep — contract value restricted to read-only on own deals' },
  { v: 2, when: '02 Apr · 11:20', actor: 'Anna Kowalska', note: 'Bank account hidden for all non-Finance roles' },
  { v: 1, when: '14 Jan · 08:00', actor: 'System', note: 'Initial template imported · Standard B2B leasing' },
];

/* ---------------- Cards (the four seed arrays) ---------------- */
// companyId mapping by customer → seeded COMPANY OrgNode. Fallback default.
const DEFAULT_COMPANY = 'cmp-rotterdam';
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
  return DEFAULT_COMPANY;
}

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

// NOTE: o1 (Brussels) intentionally NOT seeded.
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

// NOTE: f1 (Brussels) intentionally NOT seeded.
const SEED_FINANCE: RawCard[] = [
  { id: 'f2', customer: 'Munich Foods Logistics GmbH', value: 94000, type: 'INVOICE', sub: 'Invoice MFL-2024-1187', stageId: 'overdue', stageName: 'Overdue', days: 31, daysLabel: '31d overdue', owner: 'Ines Vandeput', status: 'red', cta: 'Send dunning notice', sources: ['PEPPOL'] },
  { id: 'f3', customer: 'Luxembourg Distribution S.à.r.l.', value: 185000, type: 'INVOICE', sub: 'Invoice LXD-2024-0912', stageId: 'awaiting', stageName: 'Awaiting payment', days: 12, daysLabel: 'in 18d', owner: 'Ines Vandeput', status: 'amber', cta: 'Send reminder', sources: ['PEPPOL'] },
  { id: 'f4', customer: 'Supplier · MAN Trucks AG', value: 87500, type: 'SUPPLIER', sub: 'PEPPOL invoice · 12 vehicles', stageId: 'supplier', stageName: 'Supplier invoice', days: 1, daysLabel: 'received 1d ago', owner: 'Ines Vandeput', status: 'green', cta: 'Approve for payment', sources: ['PEPPOL'] },
];

function cardRows(arr: RawCard[], track: string): CardSeed[] {
  return arr.map((c) => ({
    id: c.id,
    companyId: companyFor(c.customer),
    track: TRACK_ENUM[track],
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

/* ---------------- Vehicle timeline + portal fleet ---------------- */
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

const PORTAL_FLEET = {
  operator: 'Rotterdam Logistics B.V.',
  contact: 'Lieke van der Meer · Fleet manager',
  vehicles: [
    { plate: 'VAN-3344', model: 'Mercedes Sprinter 314', status: 'busy', statusLabel: 'In workshop', note: 'Replacement vehicle delivered · returns in 2 days' },
    { plate: 'TRK-9012', model: 'MAN TGS 26.420', status: 'ok', statusLabel: 'In fleet', note: 'Next service in 47 days' },
    { plate: 'VAN-5571', model: 'Ford Transit Custom', status: 'warn', statusLabel: 'Service due', note: 'Annual inspection in 21 days' },
    { plate: 'TRK-2284', model: 'Volvo FH 460', status: 'busy', statusLabel: 'Awaiting delivery', note: 'Expected Jun 18 — order confirmed by supplier' },
  ],
  invoices: [
    { ref: 'INV-2026-04812', value: 18420, due: 'Due in 14 days', status: 'ok' },
    { ref: 'INV-2026-04501', value: 12090, due: '31 days overdue', status: 'late' },
  ],
};

/* ---------------- Integrations ---------------- */
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

/* ---------------- Audit (incl. the historical Brussels cascade) ---------------- */
interface RawAudit {
  day: string; time: string; actor: string; actorRole?: string; verb: string; target: string;
  track: string; kind?: string; icon?: string; isSystem?: boolean; cascades?: { track: string; text: string }[];
}

const AUDIT: RawAudit[] = [
  { day: 'Today · 28 May', time: '09:14', actor: 'Markus Weber', actorRole: 'Account Director', verb: 'marked contract signed', target: 'Brussels Energy SA · €2.46M renewal', track: 'sales', kind: 'critical', icon: 'bolt', cascades: [{ track: 'operations', text: 'Created card · "Vehicle ordered · 78 vehicles"' }, { track: 'finance', text: 'Created card · "Invoice to create · €2.46M"' }, { track: 'sales', text: 'Customer portal updated · order confirmed' }] },
  { day: 'Today · 28 May', time: '08:47', actor: 'System · Talend', actorRole: 'Automated ETL · 15-min cadence', verb: 'sync completed', target: '1,240 records across 6 sources', track: 'workshop', kind: 'info', icon: 'refresh', isSystem: true },
  { day: 'Today · 28 May', time: '08:22', actor: 'Tom Janssens', actorRole: 'Fleet Operations', verb: 'confirmed delivery date', target: 'Köln Last Mile · VAN-4421 · slipped to Jun 04', track: 'operations', kind: 'normal', icon: 'truck' },
  { day: 'Today · 28 May', time: '07:55', actor: 'System · PEPPOL', actorRole: 'Inbound webhook', verb: 'invoice received', target: 'Bosch Mobility · €1,240 · matched to WO-2026-118', track: 'workshop', kind: 'info', icon: 'receipt', isSystem: true },
  { day: 'Yesterday · 27 May', time: '16:32', actor: 'Eva de Vries', actorRole: 'Account Manager · Benelux', verb: 'sent follow-up email', target: 'Rotterdam Logistics B.V. · €1.24M offer (gentle nudge)', track: 'sales', kind: 'normal', icon: 'mail' },
  { day: 'Yesterday · 27 May', time: '14:18', actor: 'Hannah Müller', actorRole: 'Service Coordinator', verb: 'scheduled workshop visit', target: 'Amsterdam Cold Chain · TRK-1108 · 4 Jun', track: 'operations', kind: 'normal', icon: 'flash', cascades: [{ track: 'workshop', text: 'New work order WO-2026-119 · expected 4 Jun' }, { track: 'operations', text: 'Replacement vehicle VAN-7811 reserved' }] },
  { day: 'Yesterday · 27 May', time: '11:04', actor: 'Ines Vandeput', actorRole: 'Accounts Payable', verb: 'approved PEPPOL invoice', target: 'MAN Trucks AG · €87,500 · payment scheduled 27 Jun', track: 'finance', kind: 'normal', icon: 'receipt' },
  { day: 'Yesterday · 27 May', time: '10:21', actor: 'System · Salesforce', actorRole: 'Inbound CRM sync', verb: 'imported new lead', target: 'Antwerp Retail Group NV · 22 vehicles · 3-year FSL', track: 'sales', kind: 'info', icon: 'plus', isSystem: true },
  { day: 'Earlier this week', time: 'May 26 · 15:50', actor: 'Sophie Janssen', actorRole: 'Account Manager · Benelux', verb: 'logged qualification meeting', target: 'Antwerp Retail Group NV', track: 'sales', kind: 'normal', icon: 'check' },
  { day: 'Earlier this week', time: 'May 25 · 09:33', actor: 'Lars Pieters', actorRole: 'Workshop Manager', verb: 'released for pickup', target: 'Rotterdam Logistics · VAN-3344 · brake-system overhaul', track: 'workshop', kind: 'normal', icon: 'check' },
  { day: 'Earlier this week', time: 'May 25 · 08:18', actor: 'System · MAN API', actorRole: 'Supplier API', verb: 'flagged order overdue', target: 'Köln Last Mile · VAN-4421 · 3 days late', track: 'operations', kind: 'warning', icon: 'bolt', isSystem: true },
];

/* ---------------- Reports (scripted prose, no API call) ---------------- */
// Mirrors app/src/reports.jsx makeSeedReports() — scriptedProse is static text.
function scriptedProse(scope: string[]): { headline: string; tracks: Record<string, string> } {
  const tracks: Record<string, string> = {};
  if (scope.includes('sales')) tracks.sales = 'Open pipeline stands at €8.62M across 5 deals. €2.39M is at risk across red deals needing follow-up, while three deals sit in contract — led by the Brussels Energy renewal awaiting signature.';
  if (scope.includes('operations')) tracks.operations = '6 vehicles are active in the flow. One delivery is running late and two vehicles are due for service; the remainder are on track.';
  if (scope.includes('workshop')) tracks.workshop = '4 work orders are open — one in repair, one released and ready for pickup, and a Bosch PEPPOL invoice awaiting approval.';
  if (scope.includes('finance')) tracks.finance = '€279k in receivables outstanding, of which €94k is 31+ days overdue. A supplier invoice is queued for payment.';
  const headline = 'Operations across the fleet are steady. Open pipeline of €8.62M with €279k in receivables. Key risks: €2.39M of at-risk deals and a €94k overdue invoice. Operations are largely on track with one late delivery.';
  return { headline, tracks };
}

const SEED_REPORTS = [
  { title: 'Weekly fleet summary', spec: { title: 'Weekly fleet summary', prompt: 'Weekly fleet summary', period: 'This week', format: 'Executive brief', scope: ['sales', 'operations', 'workshop', 'finance'] }, when: 'May 26 · 08:40', prose: scriptedProse(['sales', 'operations', 'workshop', 'finance']) },
  { title: 'Q2 cashflow & receivables', spec: { title: 'Q2 cashflow & receivables', prompt: 'Cashflow and receivables review', period: 'This quarter', format: 'Detailed breakdown', scope: ['finance'] }, when: 'May 22 · 16:12', prose: scriptedProse(['finance']) },
];

/* ---------------- Dashboard default layout ---------------- */
const DEFAULT_CHARTS = [
  { id: 'd1', metricId: 'pipeline', type: 'stat', title: 'Open pipeline' },
  { id: 'd2', metricId: 'atRisk', type: 'stat', title: 'At-risk pipeline' },
  { id: 'd3', metricId: 'wonThisWeek', type: 'stat', title: 'Closed-won this week' },
  { id: 'd4', metricId: 'pipelineStage', type: 'bar', title: 'Pipeline by stage' },
  { id: 'd5', metricId: 'ontime', type: 'donut', title: 'On-time delivery' },
  { id: 'd6', metricId: 'openByTrack', type: 'bar', title: 'Open items by track' },
];

/* ============================================================ */
async function main() {
  const passwordHash = await argon2.hash('demo1234');

  // Wipe (idempotent) — order respects FK constraints.
  await prisma.auditCascade.deleteMany();
  await prisma.auditEntry.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.vehicleTimeline.deleteMany();
  await prisma.report.deleteMany();
  await prisma.dashboardLayout.deleteMany();
  await prisma.session.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.fieldDef.deleteMany();
  await prisma.entityType.deleteMany();
  await prisma.stageDef.deleteMany();
  await prisma.trackDef.deleteMany();
  await prisma.fieldRule.deleteMany();
  await prisma.rbacVersion.deleteMany();
  await prisma.stageConfig.deleteMany();
  await prisma.crossTrigger.deleteMany();
  await prisma.userScope.deleteMany();
  await prisma.user.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.fleetOperator.deleteMany();
  await prisma.dataSharing.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.role.deleteMany();
  await prisma.countryDefaults.deleteMany();
  await prisma.orgNode.deleteMany();

  // Org tree (parents before children — flatten emits in pre-order).
  const orgRows: Prisma.OrgNodeCreateManyInput[] = [];
  flattenTree(GROUP_TREE, null, orgRows);
  for (const row of orgRows) {
    await prisma.orgNode.create({ data: row });
  }

  // Country defaults.
  for (const [code, d] of Object.entries(COUNTRY_DEFAULTS)) {
    await prisma.countryDefaults.create({ data: { code, ...d } });
  }

  // Roles.
  await prisma.role.createMany({ data: ROLES });

  // Users + secondary scopes.
  for (const u of ADMIN_USERS) {
    const roleId = ROLE_NAME_TO_ID[u.role] ?? 'sales-rep';
    const scopeNodeId = SCOPE_LABEL_TO_NODE[u.scopeLabel] ?? null;
    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        email: u.email,
        initials: u.initials,
        passwordHash,
        roleId,
        scopeType: u.scopeType as Prisma.UserCreateInput['scopeType'],
        scopeNodeId,
        scopeLabel: u.scopeLabel,
        status: u.status as Prisma.UserCreateInput['status'],
        lastSeen: u.lastSeen,
        secondary: {
          create: u.secondary.map((s) => ({
            roleId: ROLE_NAME_TO_ID[s.role] ?? null,
            scopeType: 'company' as Prisma.UserScopeCreateInput['scopeType'],
            scopeNodeId: SCOPE_LABEL_TO_NODE[s.scope] ?? null,
            scopeLabel: s.scope,
            roleLabel: s.role,
          })),
        },
      },
    });
  }

  // Field rules (diffs) — scope ANY.
  const ruleRows: Prisma.FieldRuleCreateManyInput[] = [];
  for (const [roleId, byType] of Object.entries(FIELD_RULES)) {
    for (const [dataTypeId, byField] of Object.entries(byType)) {
      for (const [fieldId, rule] of Object.entries(byField)) {
        ruleRows.push({ roleId, dataTypeId, fieldId, scope: 'ANY', visible: rule.visible, editable: rule.editable, masked: rule.masked, note: rule.note ?? null });
      }
    }
  }
  await prisma.fieldRule.createMany({ data: ruleRows });

  // RBAC versions.
  await prisma.rbacVersion.createMany({ data: RBAC_VERSIONS });

  // Stage config (ordered per track).
  const stageRows: Prisma.StageConfigCreateManyInput[] = [];
  for (const [track, stages] of Object.entries(STAGE_CONFIG)) {
    stages.forEach((s, i) => {
      stageRows.push({ track: TRACK_ENUM[track] as Prisma.StageConfigCreateManyInput['track'], order: i, stageId: s.id, label: s.label, sla: s.sla, lock: s.lock, cta: s.cta });
    });
  }
  await prisma.stageConfig.createMany({ data: stageRows });

  // Cross-track triggers (incl. Brussels rows).
  await prisma.crossTrigger.createMany({ data: CROSS_TRIGGERS });

  // Data-driven meta-model (tracks, stages, entity types, fields).
  const meta = await seedMetaModel(prisma);

  // Pipeline items as Entities (four arrays; o1/f1 absent — cascade-only).
  const seedCards: CardSeed[] = [
    ...cardRows(SEED_SALES, 'sales'),
    ...cardRows(SEED_OPS, 'operations'),
    ...cardRows(SEED_WORKSHOP, 'workshop'),
    ...cardRows(SEED_FINANCE, 'finance'),
  ];
  for (const c of seedCards) {
    await prisma.entity.create({ data: cardToEntityCreate(c, meta) });
  }

  // Vehicle timeline + events (Brussels drill-down).
  const brusselsCompany = companyFor(VEHICLE_TIMELINE.customer);
  await prisma.vehicleTimeline.create({
    data: {
      customer: VEHICLE_TIMELINE.customer,
      vehicle: VEHICLE_TIMELINE.vehicle,
      contractValue: VEHICLE_TIMELINE.contractValue,
      account: VEHICLE_TIMELINE.account,
      events: {
        create: VEHICLE_TIMELINE.events.map((e, i) => ({
          order: i, track: e.track, stage: e.stage, detail: e.detail, date: e.date, owner: e.owner, state: e.state, docs: e.docs ?? [],
        })),
      },
    },
  });

  // Portal fleet → FleetOperator + Vehicles + Invoices.
  await prisma.fleetOperator.create({ data: { name: PORTAL_FLEET.operator, contact: PORTAL_FLEET.contact, companyId: brusselsCompany === 'cmp-brussels' ? 'cmp-rotterdam' : companyFor(PORTAL_FLEET.operator), meta: { messages: 3 } } });
  for (const v of PORTAL_FLEET.vehicles) {
    await prisma.entity.create({
      data: vehicleToEntityCreate(
        { plate: v.plate, model: v.model, status: v.status, statusLabel: v.statusLabel, note: v.note, operator: PORTAL_FLEET.operator, companyId: companyFor(PORTAL_FLEET.operator) },
        meta,
      ),
    });
  }
  for (const inv of PORTAL_FLEET.invoices) {
    await prisma.invoice.create({ data: { ref: inv.ref, value: inv.value, due: inv.due, status: inv.status, companyId: companyFor(PORTAL_FLEET.operator) } });
  }

  // Sample contract counterparty as an extra fleet operator (SAMPLE_RECORDS context).
  await prisma.fleetOperator.create({ data: { name: 'Düsseldorf Bau B.V.', contact: 'J. Bakker', companyId: 'cmp-dusseldorf', meta: { vat: 'DE 811 204 119', creditLimit: '€2,000,000' } } });

  // Integrations.
  await prisma.integration.createMany({
    data: INTEGRATIONS.map((i) => ({ ...i, nango: false, transforms: 0 })),
  });

  // Audit log (incl. the historical Brussels cascade entry, with children).
  for (const a of AUDIT) {
    await prisma.auditEntry.create({
      data: {
        day: a.day, time: a.time, actor: a.actor, actorRole: a.actorRole, verb: a.verb, target: a.target,
        track: a.track, kind: a.kind ?? 'normal', icon: a.icon, isSystem: a.isSystem ?? false,
        cascades: a.cascades ? { create: a.cascades.map((c, i) => ({ order: i, track: c.track, text: c.text })) } : undefined,
      },
    });
  }

  // Reports (scripted).
  const primary = ADMIN_USERS.find((u) => u.id === 'u-markus');
  for (const r of SEED_REPORTS) {
    await prisma.report.create({
      data: { title: r.title, spec: r.spec as Prisma.InputJsonValue, prose: r.prose as Prisma.InputJsonValue, when: r.when, createdById: primary?.id ?? null },
    });
  }

  // Default dashboard for the primary user (Markus).
  if (primary) {
    await prisma.dashboardLayout.create({ data: { userId: primary.id, charts: DEFAULT_CHARTS as Prisma.InputJsonValue } });
  }

  // Sanity: ensure DATA_TYPES catalogue is referenced (kept for parity with shared).
  void DATA_TYPES;
  void FIELD_CATEGORIES;

  const counts = {
    orgNodes: await prisma.orgNode.count(),
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    entities: await prisma.entity.count(),
    fieldRules: await prisma.fieldRule.count(),
    stageConfig: await prisma.stageConfig.count(),
    crossTriggers: await prisma.crossTrigger.count(),
    integrations: await prisma.integration.count(),
    auditEntries: await prisma.auditEntry.count(),
    reports: await prisma.report.count(),
  };
  console.log('Seed complete:', JSON.stringify(counts, null, 2));
  console.log('Login: m.weber@group.eu / demo1234 (and r.mertens@group.eu, l.pieters@group.eu, etc.)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
