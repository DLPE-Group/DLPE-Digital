// Scripted (no-AI) report prose. Generic and data-driven: builds sentences from
// the already-computed per-track aggregate metrics, so it works for ANY track
// (builtin or custom) with no hardcoded domain narrative. Used as the fallback
// when no Anthropic key is configured, and by the seed.

import type { TrackAggregate } from '../domain/aggregations.js';

export interface Prose {
  headline: string;
  tracks: Record<string, string>;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// A single track's sentence, built from its metrics, e.g.
// "12 open items, with €6.7M total value, €1.2M at risk, 8 on track."
function trackSentence(agg: TrackAggregate): string {
  const parts = agg.metrics.map((m) => `${m.value} ${String(m.label).toLowerCase()}`);
  if (!parts.length) return 'No activity in this track.';
  return `${cap(parts[0])}${parts.length > 1 ? ', with ' + parts.slice(1).join(', ') : ''}.`;
}

export function scriptedProse(scope: string[], computed: Record<string, TrackAggregate>): Prose {
  const tracks: Record<string, string> = {};
  for (const t of scope) {
    if (computed[t]) tracks[t] = trackSentence(computed[t]);
  }

  // Headline: the leading metric of each in-scope track.
  const clauses = scope
    .filter((t) => computed[t])
    .map((t) => {
      const lead = computed[t].metrics[0];
      return lead ? `${lead.value} ${String(lead.label).toLowerCase()}` : null;
    })
    .filter((c): c is string => !!c);

  const headline = clauses.length
    ? `Across ${scope.length} track${scope.length === 1 ? '' : 's'}: ${clauses.join(', ')}.`
    : 'No activity to report for the selected scope.';

  return { headline, tracks };
}
