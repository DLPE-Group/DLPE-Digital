// Ported verbatim from app/src/reports.jsx `scriptedProse`, adapted to take the
// already-computed per-track aggregates instead of recomputing client-side.

import type { TrackAggregate } from '../domain/aggregations.js';

export interface Prose {
  headline: string;
  tracks: Record<string, string>;
}

export function scriptedProse(scope: string[], computed: Record<string, TrackAggregate>): Prose {
  const d = computed;
  const tracks: Record<string, string> = {};
  if (d.sales)
    tracks.sales = `Open pipeline stands at ${d.sales.metrics[0].value} across ${d.sales.metrics[1].value} deals. ${d.sales.metrics[2].value} is at risk across red deals needing follow-up, while three deals sit in contract — led by the Brussels Energy renewal awaiting signature.`;
  if (d.operations)
    tracks.operations = `${d.operations.metrics[0].value} vehicles are active in the flow. One delivery is running late and two vehicles are due for service; the remainder are on track.`;
  if (d.workshop)
    tracks.workshop = `${d.workshop.metrics[0].value} work orders are open — one in repair, one released and ready for pickup, and a Bosch PEPPOL invoice awaiting approval.`;
  if (d.finance)
    tracks.finance = `${d.finance.metrics[0].value} in receivables outstanding, of which ${d.finance.metrics[1].value} is 31+ days overdue. A supplier invoice is queued for payment.`;

  const clauses: string[] = [];
  if (d.sales) clauses.push(`${d.sales.metrics[0].value} in open pipeline`);
  if (d.finance) clauses.push(`${d.finance.metrics[0].value} in receivables`);
  const risks: string[] = [];
  if (d.sales) risks.push(`${d.sales.metrics[2].value} of at-risk deals`);
  if (d.finance) risks.push(`a ${d.finance.metrics[1].value} overdue invoice`);

  const headline = `${clauses.join(' and ') || 'Operations across the fleet are steady'}${
    clauses.length ? '.' : '.'
  } ${risks.length ? 'Key risks: ' + risks.join(' and ') + '.' : ''} ${
    d.operations ? 'Operations are largely on track with one late delivery.' : ''
  }`.trim();

  return { headline, tracks };
}
