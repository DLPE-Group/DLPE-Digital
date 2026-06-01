import { prisma } from '../prisma.js';
import { trackKeyToEnum } from './cards.service.js';
import type { Card } from '@prisma/client';

// repMoney — ported verbatim from app/src/reports.jsx.
export function repMoney(n: number): string {
  return n >= 1e6
    ? '€' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
    : n >= 1e3
      ? '€' + Math.round(n / 1e3) + 'k'
      : '€' + n;
}

const SOURCE_NAMES: Record<string, string> = {
  CRM: 'Salesforce CRM',
  API: 'Supplier APIs',
  Talend: 'Talend ETL',
  CSV: 'Bulk CSV',
  PEPPOL: 'PEPPOL',
  Exact: 'Exact Online',
};

function sourcesFrom(items: Card[]): string[] {
  const set = new Set<string>();
  items.forEach((it) => (it.sources || []).forEach((s) => set.add(s)));
  return [...set].map((s) => SOURCE_NAMES[s] || s);
}

export interface TrackAggregate {
  metrics: { label: string; value: string | number; tone?: string; sub?: string }[];
  chart: { kind: string; title: string; bars: { label: string; value: number; display: string }[] };
  sources: string[];
}

// computeTrack — server twin of the frontend, reading live DB cards.
export async function computeTrack(track: string): Promise<TrackAggregate> {
  const trackEnum = trackKeyToEnum(track);
  const items = await prisma.card.findMany({ where: { track: trackEnum } });
  const key = track.toLowerCase();

  if (key === 'sales') {
    const s = items;
    const pipeline = s.reduce((a, x) => a + (x.value ?? 0), 0);
    const risk = s.filter((x) => x.status === 'red');
    const riskVal = risk.reduce((a, x) => a + (x.value ?? 0), 0);
    const stageVal = (id: string) =>
      s.filter((x) => x.stageId === id).reduce((a, x) => a + (x.value ?? 0), 0);
    return {
      metrics: [
        { label: 'Open pipeline', value: repMoney(pipeline) },
        { label: 'Open deals', value: s.length },
        { label: 'At risk', value: repMoney(riskVal), tone: 'bad', sub: `${risk.length} deals` },
        { label: 'In contract', value: s.filter((x) => x.stageId === 'contract').length },
      ],
      chart: {
        kind: 'bar',
        title: 'Pipeline value by stage',
        bars: [
          { label: 'Meeting', value: stageVal('meeting') },
          { label: 'Offer', value: stageVal('offer') },
          { label: 'Contract', value: stageVal('contract') },
        ].map((b) => ({ ...b, display: repMoney(b.value) })),
      },
      sources: sourcesFrom(s),
    };
  }

  if (key === 'operations') {
    const o = items;
    const attention = o.filter((x) => x.status !== 'green');
    return {
      metrics: [
        { label: 'Vehicles in flow', value: o.length },
        { label: 'Needs attention', value: attention.length, tone: attention.length ? 'warn' : 'good' },
        { label: 'Delayed', value: o.filter((x) => /late/.test(x.daysLabel || '')).length },
        { label: 'Service due', value: o.filter((x) => x.stageId === 'service_due').length },
      ],
      chart: {
        kind: 'bar',
        title: 'Vehicles by status',
        bars: [
          { label: 'On track', value: o.filter((x) => x.status === 'green').length },
          { label: 'Attention', value: o.filter((x) => x.status === 'amber').length },
          { label: 'Late', value: o.filter((x) => x.status === 'red').length },
        ].map((b) => ({ ...b, display: String(b.value) })),
      },
      sources: sourcesFrom(o),
    };
  }

  if (key === 'workshop') {
    const w = items;
    const stageCount = (id: string) => w.filter((x) => x.stageId === id).length;
    return {
      metrics: [
        { label: 'Open work orders', value: w.length },
        { label: 'In repair', value: stageCount('in_repair') },
        {
          label: 'Ready for pickup',
          value: w.filter((x) => /pickup|released/i.test(x.stageName)).length,
          tone: 'good',
        },
        {
          label: 'Supplier invoices',
          value: repMoney(w.filter((x) => x.value).reduce((a, x) => a + (x.value ?? 0), 0)),
        },
      ],
      chart: {
        kind: 'bar',
        title: 'Work orders by stage',
        bars: [
          { label: 'Parts', value: stageCount('parts') },
          { label: 'In repair', value: stageCount('in_repair') },
          { label: 'Released', value: stageCount('released') },
          { label: 'Invoice in', value: stageCount('invoice_in') },
        ].map((b) => ({ ...b, display: String(b.value) })),
      },
      sources: sourcesFrom(w),
    };
  }

  // finance
  const f = items;
  const receivable = f.filter((x) => x.type === 'INVOICE');
  const overdue = receivable.filter((x) => x.stageId === 'overdue');
  const awaiting = receivable.filter((x) => x.stageId === 'awaiting');
  const payable = f.filter((x) => x.type === 'SUPPLIER');
  const sum = (arr: Card[]) => arr.reduce((a, x) => a + (x.value ?? 0), 0);
  return {
    metrics: [
      { label: 'Receivables', value: repMoney(sum(receivable)) },
      { label: 'Overdue', value: repMoney(sum(overdue)), tone: 'bad', sub: `${overdue.length} invoice` },
      { label: 'Awaiting', value: repMoney(sum(awaiting)) },
      { label: 'Supplier payable', value: repMoney(sum(payable)) },
    ],
    chart: {
      kind: 'bar',
      title: 'Receivables aging',
      bars: [
        { label: 'Current', value: sum(awaiting) },
        { label: '31d+', value: sum(overdue) },
      ].map((b) => ({ ...b, display: repMoney(b.value) })),
    },
    sources: sourcesFrom(f),
  };
}

// Dashboard snapshot payload — METRICS catalogue + DEFAULT_CHARTS init values
// ported from app/src/dashboard.jsx (static snapshot, no streaming).
export const DEFAULT_CHARTS = [
  { id: 'd1', metricId: 'pipeline', type: 'stat', title: 'Open pipeline' },
  { id: 'd2', metricId: 'atRisk', type: 'stat', title: 'At-risk pipeline' },
  { id: 'd3', metricId: 'wonThisWeek', type: 'stat', title: 'Closed-won this week' },
  { id: 'd4', metricId: 'pipelineStage', type: 'bar', title: 'Pipeline by stage' },
  { id: 'd5', metricId: 'ontime', type: 'donut', title: 'On-time delivery' },
  { id: 'd6', metricId: 'openByTrack', type: 'bar', title: 'Open items by track' },
];

// Dashboard snapshot — computed from live DB cards. Returns render-ready shapes
// matching what app/src/dashboard.jsx chart components consume.
// NOTE: wonThisWeek / ontime / followupsDue / newLeads are documented approximations
// (no first-class source columns exist for them).
export async function dashboardSnapshot() {
  const cards = await prisma.card.findMany();
  const byTrack = (t: string) => cards.filter((c) => c.track === t);
  const sumValue = (arr: Card[]) => arr.reduce((a, x) => a + (x.value ?? 0), 0);

  const sales = byTrack('SALES');
  const ops = byTrack('OPERATIONS');
  const workshop = byTrack('WORKSHOP');
  const finance = byTrack('FINANCE');

  const stageVal = (arr: Card[], id: string) =>
    sumValue(arr.filter((x) => x.stageId === id));
  const stageCount = (arr: Card[], id: string) =>
    arr.filter((x) => x.stageId === id).length;

  // Approximations
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const wonThisWeek = sumValue(
    sales.filter((x) => x.stageId === 'won' && x.updatedAt >= weekAgo),
  );
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const newLeads = cards.filter((x) => x.createdAt >= startOfToday).length;
  const followupsDue = sales.filter((x) => x.status === 'amber' || x.status === 'red').length;
  const onGreen = ops.filter((x) => x.status === 'green').length;
  const ontimePct = ops.length ? Math.round((onGreen / ops.length) * 100) : 0;

  // Finance receivables
  const receivable = finance.filter((x) => x.type === 'INVOICE');
  const current = sumValue(receivable.filter((x) => x.stageId === 'awaiting'));
  const overdue = sumValue(receivable.filter((x) => x.stageId === 'overdue'));

  return {
    asOf: new Date().toISOString(),
    metrics: {
      pipeline: { value: sumValue(sales) },
      atRisk: { value: sumValue(sales.filter((x) => x.status === 'red')) },
      wonThisWeek: { value: wonThisWeek },
      followupsDue: { value: followupsDue },
      newLeads: { value: newLeads },
      ontime: {
        pct: ontimePct,
        segments: [
          { label: 'On-time', value: ontimePct, color: 'var(--status-green)' },
          { label: 'Late', value: 100 - ontimePct, color: 'var(--status-amber)' },
        ],
      },
      receivables: {
        segments: [
          { label: 'Current', value: current, color: 'var(--track-finance)' },
          { label: '31d+ overdue', value: overdue, color: 'var(--status-red)' },
        ],
      },
      pipelineStage: {
        cats: [
          { label: 'Meeting', value: stageVal(sales, 'meeting') },
          { label: 'Offer', value: stageVal(sales, 'offer') },
          { label: 'Contract', value: stageVal(sales, 'contract') },
        ],
      },
      openByTrack: {
        cats: [
          { label: 'Sales', value: sales.length, color: 'var(--track-sales)' },
          { label: 'Operations', value: ops.length, color: 'var(--track-ops)' },
          { label: 'Workshop', value: workshop.length, color: 'var(--track-workshop)' },
          { label: 'Finance', value: finance.length, color: 'var(--track-finance)' },
        ],
      },
      workorders: {
        cats: [
          { label: 'Parts', value: stageCount(workshop, 'parts') },
          { label: 'In repair', value: stageCount(workshop, 'in_repair') },
          { label: 'Released', value: stageCount(workshop, 'released') },
          { label: 'Invoice in', value: stageCount(workshop, 'invoice_in') },
        ],
      },
    },
    defaultCharts: DEFAULT_CHARTS,
  };
}
