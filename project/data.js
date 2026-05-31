/* ============================================================
   Sample data — from the design spec
   Stage configs are config-driven per the architecture section.
   ============================================================ */

const SALES_STAGES = [
  { id: 'lead',     label: 'Lead' },
  { id: 'meeting',  label: 'Meeting' },
  { id: 'offer',    label: 'Offer sent' },
  { id: 'contract', label: 'Contract' },
  { id: 'signed',   label: 'Signed' },
  { id: 'ordered',  label: 'Vehicle ordered' },
];

const OPS_STAGES = [
  { id: 'ordered',     label: 'Ordered' },
  { id: 'expected',    label: 'Expected delivery' },
  { id: 'confirmed',   label: 'Delivery confirmed' },
  { id: 'in_fleet',    label: 'In fleet' },
  { id: 'service_due', label: 'Service due' },
  { id: 'replacement', label: 'Replacement out' },
  { id: 'moved',       label: 'Moved to workshop' },
  { id: 'pickup',      label: 'Ready for pickup' },
];

const WORKSHOP_STAGES = [
  { id: 'planned',    label: 'Planned' },
  { id: 'order',      label: 'Order created' },
  { id: 'parts',      label: 'Order parts' },
  { id: 'arrived',    label: 'Arrived' },
  { id: 'in_repair',  label: 'In repair' },
  { id: 'invoice_in', label: 'Invoice received' },
  { id: 'released',   label: 'Released' },
  { id: 'invoiced',   label: 'Invoiced PEPPOL' },
];

const FINANCE_STAGES = [
  { id: 'to_make',    label: 'To create' },
  { id: 'awaiting',   label: 'Awaiting payment' },
  { id: 'overdue',    label: 'Overdue' },
  { id: 'paid',       label: 'Paid' },
  { id: 'supplier',   label: 'Supplier invoice' },
  { id: 'approved',   label: 'Approved & paid' },
];

// Sample cards per spec
const SEED_SALES = [
  { id: 's1', customer: 'Rotterdam Logistics B.V.',  value: 1240000, type: 'NEW',
    sub: '48 vehicles · 4-year FSL', stageId: 'offer', stageName: 'Offer sent',
    days: 14, owner: 'Eva de Vries', status: 'red', cta: 'Send follow-up', sources: ['CRM'] },
  { id: 's2', customer: 'Hamburg Distribution GmbH', value: 3150000, type: 'RENEWAL',
    sub: '120 vehicles · expires Q4', stageId: 'contract', stageName: 'Contract',
    days: 6, owner: 'Markus Weber', status: 'green', cta: 'Mark contract drafted', sources: ['CRM'] },
  { id: 's3', customer: 'Antwerp Retail Group NV',   value: 620000,  type: 'NEW',
    sub: '22 vehicles · 3-year FSL', stageId: 'meeting', stageName: 'Meeting',
    days: 3, owner: 'Sophie Janssen', status: 'green', cta: 'Log qualification', sources: ['CRM'] },
  { id: 's4', customer: 'Eindhoven Construction B.V.', value: 1150000, type: 'RENEWAL',
    sub: '42 vehicles · expires in 18d', stageId: 'contract', stageName: 'Contract',
    days: 11, owner: 'Markus Weber', status: 'red', cta: 'Send follow-up', sources: ['CRM'] },
  { id: 's5', customer: 'Brussels Energy SA',        value: 2460000, type: 'RENEWAL',
    sub: '78 vehicles · 5-year FSL', stageId: 'contract', stageName: 'Contract', awaitingSign: true,
    days: 0, owner: 'Markus Weber', status: 'green', cta: 'Mark contract signed', sources: ['CRM','API'] },
];

const SEED_OPS = [
  // s1 (Brussels) appears live after the auto-trigger demo — seeded inactive
  { id: 'o2', customer: 'Köln Last Mile',      vehicle: 'VAN-4421', type: 'DELIVERY',
    sub: 'Mercedes Sprinter · order #4421', stageId: 'expected', stageName: 'Expected delivery',
    days: 3, daysLabel: '3d late', owner: 'Pieter de Boer', status: 'amber',
    cta: 'Chase supplier', sources: ['API','Talend'] },
  { id: 'o3', customer: 'Amsterdam Cold Chain', vehicle: 'TRK-1108', type: 'SERVICE',
    sub: 'Annual safety inspection due', stageId: 'service_due', stageName: 'Service due 90d',
    days: 12, daysLabel: 'in 12d', owner: 'Hannah Müller', status: 'amber',
    cta: 'Plan workshop visit', sources: ['Talend'] },
  { id: 'o4', customer: 'Düsseldorf Bau',       vehicle: 'TRK-7702', type: 'WORKSHOP',
    sub: 'Brake system overhaul', stageId: 'moved', stageName: 'Moved to workshop',
    days: 2, daysLabel: 'day 2', owner: 'Hannah Müller', status: 'green',
    cta: 'View workshop order', sources: ['API'] },
  { id: 'o5', customer: 'Rotterdam Logistics',  vehicle: 'VAN-3344', type: 'WORKSHOP',
    sub: 'Ready for collection today', stageId: 'pickup', stageName: 'Ready for pickup',
    days: 0, daysLabel: 'today', owner: 'Hannah Müller', status: 'green',
    cta: 'Notify fleet operator', sources: ['API'] },
  { id: 'o6', customer: 'Hamburg Distribution', vehicle: 'TRK-9012', type: 'WORKSHOP',
    sub: 'Replacement out · 5-day window', stageId: 'replacement', stageName: 'Replacement out',
    days: 1, daysLabel: 'day 1 of 5', owner: 'Tom Janssens', status: 'green',
    cta: 'Track loaner', sources: ['API'] },
  { id: 'o7', customer: 'Antwerp Retail Group', vehicle: 'VAN-2210', type: 'SERVICE',
    sub: 'Inspection proof received', stageId: 'service_due', stageName: 'Service due 90d',
    days: 47, daysLabel: 'in 47d', owner: 'Tom Janssens', status: 'green',
    cta: 'Reset next inspection', sources: ['Talend','CSV'] },
];

const SEED_WORKSHOP = [
  { id: 'w1', customer: 'Düsseldorf Bau',       vehicle: 'TRK-7702', type: 'WORKSHOP',
    sub: 'Brake pads + rotors ordered', stageId: 'parts', stageName: 'Order parts',
    days: 1, daysLabel: 'ETA 2d', owner: 'Lars Pieters', status: 'green',
    cta: 'Confirm parts arrival', sources: ['API'] },
  { id: 'w2', customer: 'Rotterdam Logistics',  vehicle: 'VAN-3344', type: 'WORKSHOP',
    sub: 'Repair complete · awaiting pickup', stageId: 'released', stageName: 'Ready for pickup',
    days: 0, daysLabel: 'today', owner: 'Lars Pieters', status: 'green',
    cta: 'Notify fleet operator', sources: ['API'] },
  { id: 'w3', customer: 'Antwerp Retail',       vehicle: 'TRK-5520', type: 'WORKSHOP',
    sub: 'Parts delivered · in repair', stageId: 'in_repair', stageName: 'In repair',
    days: 1, daysLabel: 'day 1 of 3', owner: 'Lars Pieters', status: 'green',
    cta: 'Update progress', sources: ['API'] },
  { id: 'w4', customer: 'Köln Last Mile',       vehicle: 'VAN-8801', type: 'SUPPLIER',
    sub: 'PEPPOL invoice received', value: 1240, stageId: 'invoice_in', stageName: 'Invoice received',
    days: 0, daysLabel: 'today', owner: 'Lars Pieters', status: 'green',
    cta: 'Approve & send to Finance', sources: ['PEPPOL'] },
];

const SEED_FINANCE = [
  { id: 'f2', customer: 'Munich Foods Logistics GmbH', value: 94000, type: 'INVOICE',
    sub: 'Invoice MFL-2024-1187', stageId: 'overdue', stageName: 'Overdue',
    days: 31, daysLabel: '31d overdue', owner: 'Ines Vandeput', status: 'red',
    cta: 'Send dunning notice', sources: ['PEPPOL'] },
  { id: 'f3', customer: 'Luxembourg Distribution S.à.r.l.', value: 185000, type: 'INVOICE',
    sub: 'Invoice LXD-2024-0912', stageId: 'awaiting', stageName: 'Awaiting payment',
    days: 12, daysLabel: 'in 18d', owner: 'Ines Vandeput', status: 'amber',
    cta: 'Send reminder', sources: ['PEPPOL'] },
  { id: 'f4', customer: 'Supplier · MAN Trucks AG', value: 87500, type: 'SUPPLIER',
    sub: 'PEPPOL invoice · 12 vehicles', stageId: 'supplier', stageName: 'Supplier invoice',
    days: 1, daysLabel: 'received 1d ago', owner: 'Ines Vandeput', status: 'green',
    cta: 'Approve for payment', sources: ['PEPPOL'] },
];

// Stage rail counts — derived from a flat list
function buildStageCounts(items, stages) {
  const counts = Object.fromEntries(stages.map(s => [s.id, 0]));
  items.forEach(it => { if (counts[it.stageId] != null) counts[it.stageId] += 1; });
  return counts;
}

// "What is the active stage" logic — uses the last stage that has items
function activeStages(items, stages) {
  const present = new Set(items.map(i => i.stageId));
  return stages.filter(s => present.has(s.id)).map(s => s.id);
}

// Vehicle timeline — drill-down (Brussels Energy SA, 78 vehicles)
const VEHICLE_TIMELINE = {
  customer: 'Brussels Energy SA',
  vehicle: 'Fleet · 78 vehicles · master agreement BES-2026-04',
  contractValue: 2460000,
  account: 'Markus Weber',
  events: [
    { track: 'sales', stage: 'Lead created',   detail: 'Inbound from Salesforce — RFP for fleet refresh', date: 'Feb 04 · 2026', owner: 'Markus Weber', state: 'done' },
    { track: 'sales', stage: 'Qualification meeting', detail: 'On-site visit · Brussels HQ', date: 'Feb 19 · 2026', owner: 'Markus Weber', state: 'done', docs: ['Meeting notes'] },
    { track: 'sales', stage: 'Offer sent',     detail: '5-year full-service lease · 78 vehicles', date: 'Mar 11 · 2026', owner: 'Markus Weber', state: 'done', docs: ['Offer letter v3.pdf'] },
    { track: 'sales', stage: 'Offer signed',   detail: 'Counter-signed digitally · Adobe Sign', date: 'May 18 · 2026', owner: 'Brussels Energy', state: 'done', docs: ['Signed offer.pdf'] },
    { track: 'sales', stage: 'Contract drafted', detail: 'Awaiting final signature — country-level addenda included', date: 'May 26 · 2026', owner: 'Markus Weber', state: 'active', docs: ['Contract draft v2.pdf'] },
    { track: 'operations', stage: 'Vehicle order created', detail: 'Auto-triggers on Sales signature', date: 'Pending', owner: 'Tom Janssens', state: 'future' },
    { track: 'operations', stage: 'Expected delivery', detail: '90 days from order — supplier confirmation required', date: 'T+90d', owner: 'Tom Janssens', state: 'future' },
    { track: 'finance',    stage: 'Invoice cycle begins', detail: 'Recurring monthly invoicing for 60 months', date: 'On first delivery', owner: 'Ines Vandeput', state: 'future' },
  ],
};

// Customer portal data — one fleet operator
const PORTAL_FLEET = {
  operator: 'Rotterdam Logistics B.V.',
  contact: 'Lieke van der Meer · Fleet manager',
  vehicles: [
    { plate: 'VAN-3344', model: 'Mercedes Sprinter 314', status: 'busy',  statusLabel: 'In workshop',     note: 'Replacement vehicle delivered · returns in 2 days' },
    { plate: 'TRK-9012', model: 'MAN TGS 26.420',        status: 'ok',    statusLabel: 'In fleet',        note: 'Next service in 47 days' },
    { plate: 'VAN-5571', model: 'Ford Transit Custom',   status: 'warn',  statusLabel: 'Service due',     note: 'Annual inspection in 21 days' },
    { plate: 'TRK-2284', model: 'Volvo FH 460',          status: 'busy',  statusLabel: 'Awaiting delivery', note: 'Expected Jun 18 — order confirmed by supplier' },
  ],
  invoices: [
    { ref: 'INV-2026-04812', value: 18420, due: 'Due in 14 days',  status: 'ok'   },
    { ref: 'INV-2026-04501', value: 12090, due: '31 days overdue', status: 'late' },
  ],
  messages: [
    { when: '2 hours ago', body: 'VAN-3344 will be ready for collection on Friday at the workshop. Replacement van returns at the same time.' },
    { when: 'Yesterday',   body: 'Annual safety inspection for VAN-5571 scheduled — please confirm a date by Jun 02.' },
    { when: '3 days ago',  body: 'TRK-2284 supplier confirmed delivery for Jun 18. We will coordinate handover one week prior.' },
  ],
};

// Expose on window for Babel-transpiled scripts
Object.assign(window, {
  SALES_STAGES, OPS_STAGES, WORKSHOP_STAGES, FINANCE_STAGES,
  SEED_SALES, SEED_OPS, SEED_WORKSHOP, SEED_FINANCE,
  VEHICLE_TIMELINE, PORTAL_FLEET,
  buildStageCounts, activeStages,
});
