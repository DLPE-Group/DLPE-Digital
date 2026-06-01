/* ============================================================
   Single source of truth for pipeline stage definitions,
   per-track stage config (SLA / lock / cta) and cross-track
   triggers. Ported from app/src/data.js + app/src/editors.jsx.
   Both the server seed and (later) the frontend import these.
   ============================================================ */

export interface StageDef {
  id: string;
  label: string;
}

export const SALES_STAGES: StageDef[] = [
  { id: 'lead', label: 'Lead' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'offer', label: 'Offer sent' },
  { id: 'contract', label: 'Contract' },
  { id: 'signed', label: 'Signed' },
  { id: 'ordered', label: 'Vehicle ordered' },
];

export const OPS_STAGES: StageDef[] = [
  { id: 'ordered', label: 'Ordered' },
  { id: 'expected', label: 'Expected delivery' },
  { id: 'confirmed', label: 'Delivery confirmed' },
  { id: 'in_fleet', label: 'In fleet' },
  { id: 'service_due', label: 'Service due' },
  { id: 'replacement', label: 'Replacement out' },
  { id: 'moved', label: 'Moved to workshop' },
  { id: 'pickup', label: 'Ready for pickup' },
];

export const WORKSHOP_STAGES: StageDef[] = [
  { id: 'planned', label: 'Planned' },
  { id: 'order', label: 'Order created' },
  { id: 'parts', label: 'Order parts' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'in_repair', label: 'In repair' },
  { id: 'invoice_in', label: 'Invoice received' },
  { id: 'released', label: 'Released' },
  { id: 'invoiced', label: 'Invoiced PEPPOL' },
];

export const FINANCE_STAGES: StageDef[] = [
  { id: 'to_make', label: 'To create' },
  { id: 'awaiting', label: 'Awaiting payment' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
  { id: 'supplier', label: 'Supplier invoice' },
  { id: 'approved', label: 'Approved & paid' },
];

export interface StageConfigEntry {
  id: string;
  label: string;
  sla: number;
  lock: string | null;
  cta: string;
}

export const STAGE_CONFIG: Record<string, StageConfigEntry[]> = {
  sales: [
    { id: 'lead', label: 'Lead', sla: 5, lock: null, cta: 'Qualify' },
    { id: 'meeting', label: 'Qualification meeting', sla: 10, lock: 'lead', cta: 'Send offer' },
    { id: 'offer', label: 'Offer sent', sla: 14, lock: 'meeting', cta: 'Send follow-up' },
    { id: 'contract', label: 'Contract drafted', sla: 10, lock: 'offer', cta: 'Mark contract signed' },
    { id: 'signed', label: 'Signed', sla: 1, lock: 'contract', cta: 'Open in CRM' },
    { id: 'ordered', label: 'Vehicle ordered', sla: 0, lock: 'signed', cta: 'Hand off to operations' },
  ],
  operations: [
    { id: 'ordered', label: 'Vehicle ordered', sla: 90, lock: null, cta: 'Confirm with supplier' },
    { id: 'expected', label: 'Expected delivery', sla: 7, lock: 'ordered', cta: 'Chase supplier' },
    { id: 'confirmed', label: 'Delivery confirmed', sla: 3, lock: 'expected', cta: 'Notify operator' },
    { id: 'in_fleet', label: 'In fleet', sla: 0, lock: 'confirmed', cta: 'Activate' },
    { id: 'service_due', label: 'Service due 90 days', sla: 90, lock: 'in_fleet', cta: 'Plan workshop visit' },
    { id: 'replacement', label: 'Replacement out', sla: 5, lock: 'service_due', cta: 'Track loaner' },
    { id: 'moved', label: 'Moved to workshop', sla: 5, lock: 'replacement', cta: 'View workshop order' },
    { id: 'pickup', label: 'Ready for pickup', sla: 1, lock: 'moved', cta: 'Notify fleet operator' },
  ],
  workshop: [
    { id: 'planned', label: 'Planned', sla: 2, lock: null, cta: 'Create work order' },
    { id: 'order', label: 'Order created', sla: 1, lock: 'planned', cta: 'Order parts' },
    { id: 'parts', label: 'Order parts', sla: 3, lock: 'order', cta: 'Confirm parts arrival' },
    { id: 'arrived', label: 'Vehicle arrived', sla: 1, lock: 'parts', cta: 'Begin repair' },
    { id: 'in_repair', label: 'In repair', sla: 5, lock: 'arrived', cta: 'Update progress' },
    { id: 'invoice_in', label: 'PEPPOL invoice received', sla: 1, lock: 'in_repair', cta: 'Approve & route to Finance' },
    { id: 'released', label: 'Released for pickup', sla: 1, lock: 'invoice_in', cta: 'Notify fleet operator' },
    { id: 'invoiced', label: 'Invoiced PEPPOL', sla: 0, lock: 'released', cta: 'Close order' },
  ],
  finance: [
    { id: 'to_make', label: 'Invoice to create', sla: 2, lock: null, cta: 'Generate invoice' },
    { id: 'awaiting', label: 'Awaiting payment', sla: 30, lock: 'to_make', cta: 'Send reminder' },
    { id: 'overdue', label: 'Overdue', sla: 14, lock: 'awaiting', cta: 'Send dunning notice' },
    { id: 'paid', label: 'Paid', sla: 0, lock: 'awaiting', cta: 'View receipt' },
    { id: 'supplier', label: 'Supplier invoice received', sla: 5, lock: null, cta: 'Approve for payment' },
    { id: 'approved', label: 'Approved & paid', sla: 0, lock: 'supplier', cta: 'View payment' },
  ],
};

export interface CrossTriggerDef {
  whenTrack: string;
  whenStage: string;
  thenTrack: string;
  thenStage: string;
  note: string;
}

export const CROSS_TRIGGERS: CrossTriggerDef[] = [
  {
    whenTrack: 'sales', whenStage: 'Contract signed',
    thenTrack: 'operations', thenStage: 'Vehicle ordered',
    note: 'Creates a new card · auto-assigned to fleet ops manager',
  },
  {
    whenTrack: 'sales', whenStage: 'Contract signed',
    thenTrack: 'finance', thenStage: 'Invoice to create',
    note: 'Creates a new card · auto-assigned to AR',
  },
  {
    whenTrack: 'operations', whenStage: 'Replacement out',
    thenTrack: 'workshop', thenStage: 'Planned',
    note: 'Creates a workshop order for the original vehicle',
  },
  {
    whenTrack: 'workshop', whenStage: 'PEPPOL invoice received',
    thenTrack: 'finance', thenStage: 'Supplier invoice received',
    note: 'Routes the approved supplier invoice to finance for payment',
  },
  {
    whenTrack: 'workshop', whenStage: 'Invoiced PEPPOL',
    thenTrack: 'finance', thenStage: 'Awaiting payment',
    note: 'Outbound customer invoice opens a finance receivable',
  },
];

export const TRACK_KEYS = ['sales', 'operations', 'workshop', 'finance'] as const;
export type TrackKey = (typeof TRACK_KEYS)[number];

// Map the lowercase frontend track key <-> Prisma Track enum.
export const TRACK_ENUM: Record<string, string> = {
  sales: 'SALES',
  operations: 'OPERATIONS',
  workshop: 'WORKSHOP',
  finance: 'FINANCE',
};
export const TRACK_KEY_FROM_ENUM: Record<string, TrackKey> = {
  SALES: 'sales',
  OPERATIONS: 'operations',
  WORKSHOP: 'workshop',
  FINANCE: 'finance',
};
