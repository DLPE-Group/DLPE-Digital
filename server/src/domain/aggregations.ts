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

// Dashboard snapshot payload — generic metric ids + DEFAULT_CHARTS init layout.
// Mirrors the generic METRICS catalogue in app/src/dashboard.jsx.
export const DEFAULT_CHARTS = [
  { id: 'd1', metricId: 'openItems', type: 'stat', title: 'Open items' },
  { id: 'd2', metricId: 'totalValue', type: 'stat', title: 'Total value' },
  { id: 'd3', metricId: 'atRisk', type: 'stat', title: 'At risk' },
  { id: 'd4', metricId: 'openByTrack', type: 'bar', title: 'Open items by track' },
  { id: 'd5', metricId: 'valueByTrack', type: 'bar', title: 'Value by track' },
];

// Dashboard snapshot — computed from live DB cards, fully generic and
// track-driven (no hardcoded track keys, stage ids, or entity types). The
// per-track breakdowns render from the tenant's own TrackDef rows, so a
// non-fleet tenant sees its own tracks (or none) rather than a fleet layout.
export async function dashboardSnapshot(userId?: string, tenantId?: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  // Track-access (H3) + scope (H4): the snapshot reflects only what the caller
  // may see, so the overview matches the side menu and the per-track lists.
  const { cards, allowed } = await scopeCardsFor(await loadPipelineCards(undefined, db), userId, db);
  // Coarse money gate: if the caller can't see contract values, mask money.
  const restricted = await callerValueRestricted(userId, 'contract', db);
  const money = (v: number) => (restricted ? null : v);
  const sumValue = (arr: Card[]) => arr.reduce((a, x) => a + (x.value ?? 0), 0);
  const opKeyOf = (c: Card) => TRACK_KEY_FROM_ENUM[c.track];

  // The tenant's tracks drive the per-track charts (operational keys + labels
  // + colors straight from TrackDef). Cross-tenant TrackDef.key uniqueness means
  // builtin keys are prefixed `<slug>-<key>`, so strip the tenant slug prefix.
  // NB: the Tenant registry is NOT RLS-filtered, so fetch by id — never findMany.
  const tenant = tenantId ? await db.tenant.findUnique({ where: { id: tenantId } }) : null;
  const pfx = tenant?.slug ? `${tenant.slug}-` : '';
  const opKey = (k: string, builtin: boolean) => (builtin && pfx && k.startsWith(pfx) ? k.slice(pfx.length) : k);
  const trackRows = await db.trackDef.findMany({ orderBy: { order: 'asc' } });
  const tracks = trackRows
    .map((t) => ({ key: opKey(t.key, t.builtin), label: t.label, color: t.color || 'var(--brand)' }))
    .filter((t) => !allowed || allowed.includes(t.key));

  const cardsInTrack = (key: string) => cards.filter((c) => opKeyOf(c) === key);
  const openByTrack = tracks.map((t) => ({ key: t.key, label: t.label, color: t.color, value: cardsInTrack(t.key).length }));
  const valueByTrack = tracks.map((t) => ({ key: t.key, label: t.label, color: t.color, value: money(sumValue(cardsInTrack(t.key))) }));

  const redCards = cards.filter((c) => c.status === 'red');

  return {
    asOf: new Date().toISOString(),
    restricted,
    metrics: {
      openItems: { value: cards.length },
      totalValue: { value: money(sumValue(cards)) },
      atRisk: { value: money(sumValue(redCards)) },
      openByTrack: { cats: openByTrack },
      valueByTrack: { cats: valueByTrack },
    },
    defaultCharts: DEFAULT_CHARTS,
  };
}
