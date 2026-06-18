/* ============================================================
   captureBlueprint — reverse provisioning (Task 6).
   Reads a live tenant's CONFIG rows and assembles a valid
   BlueprintSpec (clone-from-live). Business data (Entities,
   Invoices, FleetOperators, etc.) is intentionally excluded:
   this is a config-only capture.
   ============================================================ */

import type { PrismaClient } from '@prisma/client';
import { BlueprintSpec, SPEC_VERSION } from '@dlpe/shared';

// ---------- helpers ----------

const ORG_KIND_DOWN: Record<string, 'group' | 'region' | 'country' | 'company'> = {
  GROUP:   'group',
  REGION:  'region',
  COUNTRY: 'country',
  COMPANY: 'company',
};

type OrgNodeRow = {
  id: string;
  kind: string;
  name: string;
  code: string | null;
  meta: unknown;
  settings: unknown;
  overrides: unknown;
  parentId: string | null;
};

type OrgNodeSpec = {
  id: string;
  kind: 'group' | 'region' | 'country' | 'company';
  name: string;
  code?: string;
  meta?: unknown;
  settings?: unknown;
  overrides?: unknown;
  children: OrgNodeSpec[];
};

/**
 * Rebuild an OrgNode tree from a flat list of rows.
 * Root = the node with no parentId (or the GROUP-kind node if parentId
 * happens to point outside the tenant's set).
 */
function buildOrgTree(rows: OrgNodeRow[]): OrgNodeSpec {
  const byId = new Map<string, OrgNodeSpec>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      kind: ORG_KIND_DOWN[r.kind] ?? 'group',
      name: r.name,
      ...(r.code ? { code: r.code } : {}),
      ...(r.meta ? { meta: r.meta } : {}),
      ...(r.settings ? { settings: r.settings } : {}),
      ...(r.overrides ? { overrides: r.overrides } : {}),
      children: [],
    });
  }

  let root: OrgNodeSpec | undefined;
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId && byId.has(r.parentId)) {
      byId.get(r.parentId)!.children.push(node);
    } else {
      // No parent in this tenant's set → this is the root
      root = node;
    }
  }

  if (!root) {
    // Fallback: find the GROUP node
    root = [...byId.values()].find((n) => n.kind === 'group') ?? [...byId.values()][0];
    if (!root) throw new Error('captureBlueprint: no org nodes found for tenant');
  }

  return root;
}

// ---------- main export ----------

export async function captureBlueprint(
  prisma: PrismaClient,
  tenantId: string,
): Promise<BlueprintSpec> {
  // ------------------------------------------------------------------
  // 1. Read all config rows in parallel
  // ------------------------------------------------------------------
  const [orgNodes, roles, fieldRules, trackDefs, crossTriggers, entityTypes] =
    await Promise.all([
      prisma.orgNode.findMany({
        where: { tenantId },
        select: { id: true, kind: true, name: true, code: true, meta: true, settings: true, overrides: true, parentId: true },
      }),
      prisma.role.findMany({
        where: { tenantId },
        select: { id: true, name: true, system: true, tracks: true, edit: true, desc: true },
      }),
      prisma.fieldRule.findMany({
        where: { tenantId },
        select: { roleId: true, dataTypeId: true, fieldId: true, scope: true, visible: true, editable: true, masked: true, note: true },
      }),
      prisma.trackDef.findMany({
        where: { tenantId },
        orderBy: { order: 'asc' },
        select: { key: true, label: true, color: true, icon: true, order: true, builtin: true,
          stages: { orderBy: { order: 'asc' }, select: { stageId: true, label: true, sla: true, lock: true, cta: true, order: true } } },
      }),
      prisma.crossTrigger.findMany({
        where: { tenantId },
        select: { whenTrack: true, whenStage: true, thenTrack: true, thenStage: true, note: true },
      }),
      prisma.entityType.findMany({
        where: { tenantId },
        orderBy: { order: 'asc' },
        select: { key: true, label: true, kind: true, icon: true, color: true, order: true, builtin: true,
          track: { select: { key: true } },
          fieldDefs: { orderBy: { order: 'asc' }, select: { key: true, label: true, category: true, dataKind: true, order: true, builtin: true } } },
      }),
    ]);

  // ------------------------------------------------------------------
  // 2. Assemble orgStructure
  // ------------------------------------------------------------------
  const orgStructure = buildOrgTree(orgNodes as OrgNodeRow[]);

  // ------------------------------------------------------------------
  // 3. Synthesize adminUser — pick a group-admin role or fall back to first
  // ------------------------------------------------------------------
  const adminRole = roles.find((r) => r.id === 'group-admin') ?? roles[0];
  if (!adminRole) throw new Error(`captureBlueprint: no roles found for tenant ${tenantId}`);

  const adminUser = {
    idPrefix: 'u',
    name: 'Admin',
    email: `admin@${tenantId}.invalid`,
    roleId: adminRole.id,
    scopeType: 'group',
  };

  // ------------------------------------------------------------------
  // 4. Build the spec object
  // ------------------------------------------------------------------
  const result = {
    specVersion: SPEC_VERSION as typeof SPEC_VERSION,
    inputs: [],          // captured blueprint is concrete — no runtime inputs needed
    orgStructure,
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      system: r.system,
      tracks: r.tracks,
      edit: r.edit,
      desc: r.desc,
    })),
    fieldRules: fieldRules.map((fr) => ({
      roleId: fr.roleId,
      dataTypeId: fr.dataTypeId,
      fieldId: fr.fieldId,
      scope: fr.scope,
      visible: fr.visible,
      editable: fr.editable,
      masked: fr.masked,
      ...(fr.note ? { note: fr.note } : {}),
    })),
    tracks: trackDefs.map((t) => ({
      key: t.key,
      label: t.label,
      ...(t.color ? { color: t.color } : {}),
      ...(t.icon ? { icon: t.icon } : {}),
      order: t.order,
      builtin: t.builtin,
      stages: t.stages.map((s) => ({
        stageId: s.stageId,
        label: s.label,
        sla: s.sla,
        ...(s.lock ? { lock: s.lock } : {}),
        cta: s.cta,
        order: s.order,
      })),
    })),
    crossTriggers: crossTriggers.map((ct) => ({
      whenTrack: ct.whenTrack,
      whenStage: ct.whenStage,
      thenTrack: ct.thenTrack,
      thenStage: ct.thenStage,
      note: ct.note,
    })),
    entityTypes: entityTypes.map((et) => ({
      key: et.key,
      label: et.label,
      kind: et.kind as 'pipeline' | 'reference',
      ...(et.track?.key ? { trackKey: et.track.key } : {}),
      ...(et.icon ? { icon: et.icon } : {}),
      ...(et.color ? { color: et.color } : {}),
      order: et.order,
      builtin: et.builtin,
      fields: et.fieldDefs.map((fd) => ({
        key: fd.key,
        label: fd.label,
        ...(fd.category ? { category: fd.category } : {}),
        dataKind: fd.dataKind,
        order: fd.order,
        builtin: fd.builtin,
      })),
    })),
    adminUser,
    // seed is intentionally omitted — config only, no business rows
  };

  // ------------------------------------------------------------------
  // 5. Validate before returning — fail loudly if the capture is malformed
  // ------------------------------------------------------------------
  return BlueprintSpec.parse(result);
}
