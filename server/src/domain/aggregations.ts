import { prisma } from '../prisma.js';
import { userAllowedTracks, loadPipelineCards } from './cards.service.js';
import { visibleCompanyIds } from '../rbac/scope.js';
import { buildEffectiveForUser } from '../rbac/context.js';
import { valueRestricted } from '../rbac/applyCardRules.js';
import { TRACK_KEY_FROM_ENUM, TRACK_ENUM } from '@dlpe/shared';
import type { CardDTO as Card } from '@dlpe/shared';
import type { Prisma } from '@prisma/client';

// Apply track-access (H3) + row-level scope (H4) to a card set for the caller.
// Returns the scoped cards plus the caller's allowed track keys (null = all,
// e.g. unauthenticated callers — no filtering).
async function scopeCardsFor(
  cards: Card[],
  userId?: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ cards: Card[]; allowed: string[] | null }> {
  if (!userId) return { cards, allowed: null };
  const allowed = await userAllowedTracks(userId, db);
  let out = cards.filter((c) => allowed.includes(TRACK_KEY_FROM_ENUM[c.track]));
  const visible = await visibleCompanyIds(userId, db);
  if (visible) out = out.filter((c) => c.companyId != null && visible.has(c.companyId));
  return { cards: out, allowed };
}

const MASK = '€XXX,XXX';
// Per-type money restriction for the caller (e.g. 'contract', 'invoice',
// 'workshop_order') — so aggregates follow per-EntityType field rules.
async function callerValueRestricted(userId?: string, typeKey = 'contract', db: Prisma.TransactionClient | typeof prisma = prisma): Promise<boolean> {
  if (!userId) return false;
  try {
    const { effective } = await buildEffectiveForUser(userId, db);
    return valueRestricted(effective, typeKey);
  } catch {
    return false;
  }
}

// The pipeline EntityType key whose money governs a given track's aggregates.
const TYPE_KEY_BY_TRACK_KEY: Record<string, string> = {
  sales: 'contract', operations: 'operation', workshop: 'workshop_order', finance: 'invoice',
};

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
// When the caller may not see contract values, money figures are masked.
export async function computeTrack(track: string, userId?: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<TrackAggregate> {
  const raw = await loadPipelineCards(track.toLowerCase(), db);
  const key = track.toLowerCase();
  // Track-access (H3) + scope (H4): if the caller can't view this track, the
  // scoped set is empty and every metric computes to zero.
  const { cards: items } = await scopeCardsFor(raw, userId, db);
  const restricted = await callerValueRestricted(userId, TYPE_KEY_BY_TRACK_KEY[key] ?? 'contract', db);
  const stages = await loadTrackStages(key, items, db);
  const agg = computeTrackInner(items, stages);
  if (!restricted) return agg;
  // Mask any money-shaped string (starts with €) in metrics + chart displays.
  const maskMoney = (s: string | number) => (typeof s === 'string' && s.startsWith('€') ? MASK : s);
  return {
    ...agg,
    metrics: agg.metrics.map((m) => ({ ...m, value: maskMoney(m.value) })),
    chart: { ...agg.chart, bars: agg.chart.bars.map((b) => ({ ...b, display: typeof b.display === 'string' && b.display.startsWith('€') ? MASK : b.display })) },
  };
}

export interface TrackStage { id: string; label: string }

// Load the ordered stage set for a track. Prefer the tenant's saved StageConfig
// (matched via the Track enum for builtin tracks); fall back to the distinct
// stages actually present on the cards so custom/enum-less tracks still chart.
async function loadTrackStages(key: string, cards: Card[], db: Prisma.TransactionClient | typeof prisma): Promise<TrackStage[]> {
  const trackEnum = TRACK_ENUM[key];
  if (trackEnum) {
    const rows = await db.stageConfig.findMany({
      where: { track: trackEnum as Prisma.StageConfigWhereInput['track'] },
      orderBy: { order: 'asc' },
    });
    if (rows.length) return rows.map((r) => ({ id: r.stageId, label: r.label }));
  }
  return distinctStagesFromCards(cards);
}

// Distinct stages present on a card set, in first-seen order (best-effort when
// no StageConfig exists for the track).
function distinctStagesFromCards(cards: Card[]): TrackStage[] {
  const seen = new Map<string, string>();
  for (const c of cards) {
    if (c.stageId && !seen.has(c.stageId)) seen.set(c.stageId, c.stageName || c.stageId);
  }
  return [...seen.entries()].map(([id, label]) => ({ id, label }));
}

// Generic, data-driven per-track aggregate — works for ANY track (builtin or
// custom) with NO hardcoded stage ids or entity types. Metrics: open item
// count, total value (only when the track carries money), at-risk, and on-track.
// The chart is a per-stage breakdown over the track's real stages (value when
// the track has money, otherwise item count).
function computeTrackInner(items: Card[], stages: TrackStage[]): TrackAggregate {
  const sum = (arr: Card[]) => arr.reduce((a, x) => a + (x.value ?? 0), 0);
  const hasMoney = items.some((x) => typeof x.value === 'number' && x.value);
  const red = items.filter((x) => x.status === 'red');
  const green = items.filter((x) => x.status === 'green');

  const metrics: TrackAggregate['metrics'] = [
    { label: 'Open items', value: items.length },
  ];
  if (hasMoney) metrics.push({ label: 'Total value', value: repMoney(sum(items)) });
  metrics.push({
    label: 'At risk',
    value: hasMoney ? repMoney(sum(red)) : red.length,
    tone: red.length ? 'bad' : undefined,
    sub: `${red.length} ${red.length === 1 ? 'item' : 'items'}`,
  });
  metrics.push({ label: 'On track', value: green.length, tone: green.length ? 'good' : undefined });

  const stageList = stages.length ? stages : distinctStagesFromCards(items);
  const bars = stageList.map((st) => {
    const inStage = items.filter((x) => x.stageId === st.id);
    const value = hasMoney ? sum(inStage) : inStage.length;
    return { label: st.label, value, display: hasMoney ? repMoney(value) : String(value) };
  });

  return {
    metrics,
    chart: { kind: 'bar', title: hasMoney ? 'Value by stage' : 'Items by stage', bars },
    sources: sourcesFrom(items),
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
export async function dashboardSnapshot(userId?: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  // Track-access (H3) + scope (H4): the snapshot reflects only what the caller
  // may see, so the overview matches the side menu and the per-track lists.
  const { cards, allowed } = await scopeCardsFor(await loadPipelineCards(undefined, db), userId, db);
  // Per-type money gates: Sales money follows the contract rules, Finance money
  // follows the invoice rules — so the dashboard reflects per-EntityType field
  // governance ("aggregates follow").
  const restricted = await callerValueRestricted(userId, 'contract', db);
  const restrictedInvoice = await callerValueRestricted(userId, 'invoice', db);
  const money = (v: number) => (restricted ? null : v); // Sales/contract money
  const moneyInv = (v: number) => (restrictedInvoice ? null : v); // Finance/invoice money
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
    sales.filter((x) => x.stageId === 'won' && !!x.updatedAt && x.updatedAt >= weekAgo),
  );
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const newLeads = cards.filter((x) => !!x.createdAt && x.createdAt >= startOfToday).length;
  const followupsDue = sales.filter((x) => x.status === 'amber' || x.status === 'red').length;
  const onGreen = ops.filter((x) => x.status === 'green').length;
  const ontimePct = ops.length ? Math.round((onGreen / ops.length) * 100) : 0;

  // Finance receivables
  const receivable = finance.filter((x) => x.type === 'INVOICE');
  const current = sumValue(receivable.filter((x) => x.stageId === 'awaiting'));
  const overdue = sumValue(receivable.filter((x) => x.stageId === 'overdue'));

  return {
    asOf: new Date().toISOString(),
    restricted,
    metrics: {
      pipeline: { value: money(sumValue(sales)) },
      atRisk: { value: money(sumValue(sales.filter((x) => x.status === 'red'))) },
      wonThisWeek: { value: money(wonThisWeek) },
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
          { label: 'Current', value: moneyInv(current), color: 'var(--track-finance)' },
          { label: '31d+ overdue', value: moneyInv(overdue), color: 'var(--status-red)' },
        ],
      },
      pipelineStage: {
        cats: [
          { label: 'Meeting', value: money(stageVal(sales, 'meeting')) },
          { label: 'Offer', value: money(stageVal(sales, 'offer')) },
          { label: 'Contract', value: money(stageVal(sales, 'contract')) },
        ],
      },
      openByTrack: {
        // Only tracks the caller may view (null = all, for unauthenticated/admin-all).
        cats: [
          { key: 'sales', label: 'Sales', value: sales.length, color: 'var(--track-sales)' },
          { key: 'operations', label: 'Operations', value: ops.length, color: 'var(--track-ops)' },
          { key: 'workshop', label: 'Workshop', value: workshop.length, color: 'var(--track-workshop)' },
          { key: 'finance', label: 'Finance', value: finance.length, color: 'var(--track-finance)' },
        ].filter((c) => !allowed || allowed.includes(c.key)),
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
