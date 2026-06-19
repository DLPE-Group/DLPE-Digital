/* ============================================================
   derive.ts — pure derivation helpers shared by provisionTenant
   and the preflight route, so preview and reality never drift.
   No DB access; no side effects.
   ============================================================ */
import { z } from 'zod';
import type { BlueprintSpec } from '@dlpe/shared';

/** Slugify a display name → URL/subdomain-safe lowercase string. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Validate runtime inputs against spec.inputs (required-field presence). */
export function validateInputs(
  spec: BlueprintSpec,
  inputs: Record<string, unknown>,
): { ok: boolean; missing: string[] } {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of spec.inputs) {
    const base: z.ZodTypeAny = z.string();
    shape[field.key] = field.required ? base : base.optional();
  }
  const parsed = z.object(shape).safeParse(inputs);
  if (parsed.success) return { ok: true, missing: [] };
  const missing = parsed.error.issues.map((i) => String(i.path[0]));
  return { ok: false, missing };
}

/** Resolve slug/name/region exactly as provisionTenant does. */
export function resolveSlugName(
  spec: BlueprintSpec,
  inputs: Record<string, unknown>,
): { slug: string; name: string; region: string } {
  const slug =
    typeof inputs.slug === 'string' && inputs.slug
      ? slugify(inputs.slug)
      : slugify((inputs.customerName as string | undefined) ?? spec.adminUser.name);
  const name = (inputs.customerName as string | undefined) ?? slug;
  const region = (inputs.region as string | undefined) ?? 'eu';
  return { slug, name, region };
}

/** Resolve the default plan key: explicit override → spec default → 'starter'. */
export function resolvePlanKey(spec: BlueprintSpec, planKey?: string): string {
  return planKey ?? spec.defaultPlanKey ?? 'starter';
}

/** Count nodes in an org-node tree. */
function countOrgNodes(node: BlueprintSpec['orgStructure']): number {
  let n = 1;
  for (const c of node.children ?? []) n += countOrgNodes(c);
  return n;
}

/** Generic, domain-agnostic counts of what a blueprint will create. */
export function summarizeBlueprint(spec: BlueprintSpec) {
  return {
    orgNodes: countOrgNodes(spec.orgStructure),
    roles: spec.roles.length,
    tracks: spec.tracks.length,
    entityTypes: spec.entityTypes.length,
    users: spec.users?.length ?? 0,
    crossTriggers: spec.crossTriggers.length,
    seedEntities: spec.seed?.entities?.length ?? 0,
  };
}
