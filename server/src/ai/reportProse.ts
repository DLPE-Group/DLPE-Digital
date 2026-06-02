import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, MODEL } from './anthropic.js';
import { scriptedProse, type Prose } from './scriptedProse.js';
import { computeTrack, type TrackAggregate } from '../domain/aggregations.js';
import type { ReportSpec } from '@dlpe/shared';

// Robust JSON extraction — ported from app/src/reports.jsx `parseProseJSON`.
function parseProseJSON(text: string | null | undefined): Prose | null {
  if (!text) return null;
  const s = String(text)
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  try {
    const parsed = JSON.parse(s.slice(a, b + 1));
    if (parsed && parsed.headline && parsed.tracks) return parsed as Prose;
    return null;
  } catch {
    return null;
  }
}

// Build the prompt from computed aggregates → call Anthropic → parse → fall back.
export async function generateProse(spec: ReportSpec, userId?: string): Promise<Prose> {
  const computed: Record<string, TrackAggregate> = {};
  for (const t of spec.scope) computed[t] = await computeTrack(t, userId);

  // No key configured → scripted fallback.
  if (!anthropic) return scriptedProse(spec.scope, computed);

  const data: Record<string, unknown> = {};
  spec.scope.forEach((t) => (data[t] = computed[t].metrics));

  // Stable instruction prefix is cached; volatile request specifics follow.
  const prefix = `You are the analyst of an "Intelligence Layer" fleet-operations console for DLPE-Group.
Reply with ONLY a JSON object, no markdown. Keep it crisp and specific to the figures. Use ONLY the computed figures provided (do not invent numbers).`;

  const prompt = `Write a ${spec.format} report titled "${spec.title}" covering ${spec.period.toLowerCase()}.
The user's request: "${spec.prompt || spec.title}".
Figures: ${JSON.stringify(data)}
JSON shape: {"headline":"2-3 sentence executive summary","tracks":{${spec.scope
    .map((t) => `"${t}":"1-2 sentence analysis"`)
    .join(',')}}}
${spec.format === 'Board summary' ? 'Frame for a board: lead with risk and money.' : ''}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: prefix, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = parseProseJSON(text);
    if (parsed) return parsed;
  } catch {
    // fall through to scripted
  }
  return scriptedProse(spec.scope, computed);
}

// Re-export for the seed (which builds scripted reports without an API call).
export { scriptedProse };
