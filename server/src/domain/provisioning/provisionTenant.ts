/* ============================================================
   provisionTenant — atomic blueprint interpreter (Task 4).
   Turns a BlueprintSpec + runtime inputs into a fully-isolated
   tenant's rows inside one prisma.$transaction.

   Key design decisions:
   - The owner `prisma` client bypasses RLS (no withTenant/appPrisma).
   - Spec-level IDs (org nodes, roles) are prefixed with the tenant slug
     to avoid unique-constraint collisions in the shared schema.
   - TrackDef.key / EntityType.key are namespaced as "<slug>-<key>".
   - StageConfig.@@unique([track,stageId]) is schema-scoped (no tenantId),
     so we use createMany + skipDuplicates to never overwrite an existing row
     (per-tenant stage config is a multi-tenant follow-up).
   - ProvisioningRun is written OUTSIDE the data transaction so that a
     rollback of the data does not erase the failure audit trail.
   ============================================================ */

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { prisma as defaultPrisma } from '../../prisma.js';
import type { BlueprintSpec as BlueprintSpecType } from '@dlpe/shared';
import type { ProvisioningTarget } from './target.js';
import { Prisma, PrismaClient } from '@prisma/client';

// ---------- public types ----------

export interface ProvisioningResult {
  tenantId: string;
  slug: string;
  adminLoginOrInviteLink: string;
}

export interface ProvisionTenantArgs {
  blueprint: { id?: string; spec: BlueprintSpecType };
  inputs: Record<string, unknown>;
  target: ProvisioningTarget;
  tenantId?: string;
  idempotencyKey?: string;
  /**
   * Controls how spec-local IDs are handled.
   * - 'prefixed' (default): all spec IDs are prefixed with `<slug>-` to avoid
   *   cross-tenant uniqueness clashes. TrackDef.key / EntityType.key are also
   *   namespaced as `<slug>-<key>`. Admin user id is `<idPrefix>-<slug>`.
   * - 'literal': the prefix is '' (empty). TrackDef.key / EntityType.key are
   *   used verbatim. Admin/user ids are used verbatim.
   */
  idMode?: 'prefixed' | 'literal';
  /** Optional prisma client override — defaults to the owner (bypass-RLS) client.
   *  Useful in tests to point at the test database. */
  prismaClient?: PrismaClient;
}

// ---------- helpers ----------

/** Slugify a display name → URL/subdomain-safe lowercase string. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Walk an org-node tree depth-first, emitting flat rows (parents first). */
type OrgNodeSpec = BlueprintSpecType['orgStructure'];

function flattenOrgTree(
  node: OrgNodeSpec,
  parentId: string | null,
  tenantId: string,
  prefix: string,
  out: Prisma.OrgNodeCreateManyInput[],
): void {
  const ORG_KIND: Record<string, Prisma.OrgNodeCreateManyInput['kind']> = {
    group: 'GROUP',
    region: 'REGION',
    country: 'COUNTRY',
    company: 'COMPANY',
  };
  const id = `${prefix}${node.id}`;
  out.push({
    id,
    kind: ORG_KIND[node.kind],
    name: node.name,
    code: node.code ?? null,
    meta: (node.meta as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    settings: (node.settings as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    overrides: (node.overrides as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    parentId,
    tenantId,
  });
  for (const child of node.children ?? []) {
    flattenOrgTree(child, id, tenantId, prefix, out);
  }
}

/** Map the Track enum used in SMALL_SPEC and the schema. */
const TRACK_ENUM: Record<string, string> = {
  sales: 'SALES',
  operations: 'OPERATIONS',
  workshop: 'WORKSHOP',
  finance: 'FINANCE',
};

// ---------- main export ----------

export async function provisionTenant(args: ProvisionTenantArgs): Promise<ProvisioningResult> {
  const { blueprint, inputs, target, idempotencyKey } = args;
  const prisma = args.prismaClient ?? defaultPrisma;
  const spec = blueprint.spec;
  const idMode = args.idMode ?? 'prefixed';

  // ------------------------------------------------------------------
  // 1. Validate inputs against spec.inputs
  // ------------------------------------------------------------------
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of spec.inputs) {
    const base: z.ZodTypeAny = z.string(); // all inputs are strings for now
    shape[field.key] = field.required ? base : base.optional();
  }
  const InputSchema = z.object(shape);
  const parsed = InputSchema.safeParse(inputs);
  if (!parsed.success) {
    const offending = parsed.error.issues.map((i) => i.path[0]).join(', ');
    throw new Error(`Invalid inputs: ${offending}`);
  }

  // ------------------------------------------------------------------
  // 2. Derive slug + name
  // ------------------------------------------------------------------
  const slug =
    typeof inputs.slug === 'string' && inputs.slug
      ? slugify(inputs.slug)
      : slugify((inputs.customerName as string | undefined) ?? spec.adminUser.name);
  const name = (inputs.customerName as string | undefined) ?? slug;
  const region = (inputs.region as string | undefined) ?? 'eu';

  // ------------------------------------------------------------------
  // 3. Idempotency guard — short-circuit if SUCCEEDED run exists
  // ------------------------------------------------------------------
  const iKey = idempotencyKey ?? `auto-${randomUUID()}`;

  if (idempotencyKey) {
    const existing = await prisma.provisioningRun.findUnique({ where: { idempotencyKey: iKey } });
    if (existing?.status === 'SUCCEEDED' && existing.tenantId) {
      return {
        tenantId: existing.tenantId,
        slug: existing.slug,
        adminLoginOrInviteLink: `/login?email=${encodeURIComponent(spec.adminUser.email)}`,
      };
    }
  }

  // ------------------------------------------------------------------
  // 4. Ensure a Blueprint record exists (ProvisioningRun.blueprintId is required)
  // ------------------------------------------------------------------
  let blueprintId = blueprint.id;
  if (!blueprintId) {
    const bp = await prisma.blueprint.create({
      data: {
        key: `auto-${iKey}`,
        name: `Auto blueprint for ${name}`,
        version: spec.specVersion,
        status: 'DRAFT',
        spec: spec as unknown as Prisma.InputJsonValue,
      },
    });
    blueprintId = bp.id;
  }

  // Create a PENDING ProvisioningRun BEFORE the data transaction
  const run = await prisma.provisioningRun.create({
    data: {
      idempotencyKey: iKey,
      blueprintId,
      slug,
      status: 'PENDING',
    },
  });

  // ------------------------------------------------------------------
  // 5. Atomic data transaction
  // ------------------------------------------------------------------
  let result: ProvisioningResult;
  try {
    result = await prisma.$transaction(async (tx) => {
      // 5a. Create the Tenant
      const ctx = await target.prepare(
        { slug, name, region, tenantId: args.tenantId },
        tx,
      );
      const tenantId = ctx.tenantId;

      // Prefix for all spec-local IDs to avoid unique clashes across tenants.
      // In literal mode the prefix is empty so IDs are used verbatim.
      const pfx = idMode === 'literal' ? '' : `${slug}-`;

      // 5b. Org tree (parents before children)
      const orgRows: Prisma.OrgNodeCreateManyInput[] = [];
      flattenOrgTree(spec.orgStructure, null, tenantId, pfx, orgRows);
      for (const row of orgRows) {
        await tx.orgNode.create({ data: row });
      }

      // 5c. Roles
      if (spec.roles.length > 0) {
        await tx.role.createMany({
          data: spec.roles.map((r) => ({
            id: `${pfx}${r.id}`,
            name: r.name,
            system: r.system,
            tracks: r.tracks,
            edit: r.edit,
            desc: r.desc,
            tenantId,
          })),
        });
      }

      // 5d. FieldRules
      if (spec.fieldRules.length > 0) {
        await tx.fieldRule.createMany({
          data: spec.fieldRules.map((fr) => ({
            roleId: `${pfx}${fr.roleId}`,
            dataTypeId: fr.dataTypeId,
            fieldId: fr.fieldId,
            scope: fr.scope as Prisma.FieldRuleCreateManyInput['scope'],
            visible: fr.visible,
            editable: fr.editable,
            masked: fr.masked,
            note: fr.note ?? null,
            tenantId,
          })),
        });
      }

      // 5e. Tracks → TrackDef + StageDef + StageConfig
      const trackDefIdByKey: Record<string, string> = {};
      for (const track of spec.tracks) {
        // In prefixed mode key is namespaced as <slug>-<track.key> to avoid TrackDef.key unique clash.
        // In literal mode the key is used verbatim.
        const tKey = idMode === 'literal' ? track.key : `${pfx}${track.key}`;

        const td = await tx.trackDef.create({
          data: {
            key: tKey,
            label: track.label,
            color: track.color ?? null,
            icon: track.icon ?? null,
            order: track.order,
            builtin: track.builtin,
            tenantId,
          },
        });
        trackDefIdByKey[track.key] = td.id;

        // StageDefs (one per stage)
        if (track.stages.length > 0) {
          await tx.stageDef.createMany({
            data: track.stages.map((s) => ({
              trackId: td.id,
              order: s.order,
              stageId: s.stageId,
              label: s.label,
              sla: s.sla,
              lock: s.lock ?? null,
              cta: s.cta,
              tenantId,
            })),
          });
        }

        // StageConfig.@@unique is global (no tenantId) — skip duplicates rather than overwrite;
        // per-tenant stage config is a multi-tenant follow-up (S0 read-scoping residual).
        const trackEnum = TRACK_ENUM[track.key];
        if (trackEnum) {
          await tx.stageConfig.createMany({
            data: track.stages.map((s) => ({
              track: trackEnum as Prisma.StageConfigCreateManyInput['track'],
              order: s.order,
              stageId: s.stageId,
              label: s.label,
              sla: s.sla,
              lock: s.lock ?? null,
              cta: s.cta,
              tenantId,
            })),
            skipDuplicates: true,
          });
        }
        // If no TRACK_ENUM mapping (custom track), we skip StageConfig — only builtin
        // Track enum values are supported by the current schema's Track enum.
      }

      // 5f. CrossTriggers
      if (spec.crossTriggers.length > 0) {
        await tx.crossTrigger.createMany({
          data: spec.crossTriggers.map((ct) => ({
            whenTrack: ct.whenTrack,
            whenStage: ct.whenStage,
            thenTrack: ct.thenTrack,
            thenStage: ct.thenStage,
            note: ct.note,
            tenantId,
          })),
        });
      }

      // 5g. EntityTypes + FieldDefs
      for (const et of spec.entityTypes) {
        // In prefixed mode key is namespaced as <slug>-<et.key> to avoid EntityType.key unique clash.
        // In literal mode the key is used verbatim.
        const etKey = idMode === 'literal' ? et.key : `${pfx}${et.key}`;
        const trackId =
          et.kind === 'pipeline' && et.trackKey
            ? (trackDefIdByKey[et.trackKey] ?? null)
            : null;

        const etRow = await tx.entityType.create({
          data: {
            key: etKey,
            label: et.label,
            kind: et.kind,
            trackId,
            icon: et.icon ?? null,
            color: et.color ?? null,
            order: et.order,
            builtin: et.builtin,
            tenantId,
          },
        });

        if (et.fields.length > 0) {
          await tx.fieldDef.createMany({
            data: et.fields.map((f) => ({
              entityTypeId: etRow.id,
              key: f.key,
              label: f.label,
              category: f.category ?? null,
              dataKind: f.dataKind,
              order: f.order,
              builtin: f.builtin,
              tenantId,
            })),
          });
        }
      }

      // 5h. Seed — optional generic entities
      // Task 8 extends seed writing (timeline/portal/integrations/audit/reports/dashboard)
      if (spec.seed?.entities && spec.seed.entities.length > 0) {
        // Generic entity seed — treat each element as a pre-formed Entity descriptor.
        // The rich demo seed payload (vehicle timeline, portal fleet, integrations,
        // audit, reports, dashboard) is handled in Task 8.
        for (const e of spec.seed.entities as Array<Record<string, unknown>>) {
          await tx.entity.create({
            data: {
              id: typeof e.id === 'string' ? `${pfx}${e.id}` : randomUUID(),
              tenantId,
              entityTypeId: typeof e.entityTypeId === 'string' ? e.entityTypeId : '',
              title: typeof e.title === 'string' ? e.title : 'Untitled',
              status: typeof e.status === 'string' ? e.status : null,
              sources: Array.isArray(e.sources) ? (e.sources as string[]) : [],
            },
          });
        }
      }

      // 5i. Users — spec.users[] + admin user

      // Derive admin user id based on id mode.
      // In prefixed mode: <idPrefix>-<slug>. In literal mode: idPrefix verbatim.
      const adminUser = spec.adminUser;
      const adminUserId = idMode === 'literal'
        ? adminUser.idPrefix
        : `${adminUser.idPrefix}-${slug}`;

      // Collect the set of user ids to create from spec.users[] (after id-mode applied).
      const specUsersById = new Map<string, NonNullable<BlueprintSpecType['users']>[number]>();
      for (const u of spec.users ?? []) {
        const uid = idMode === 'literal' ? u.id : `${pfx}${u.id}`;
        specUsersById.set(uid, u);
      }

      // Hash helper — argon2 hash password if provided, else use 'demo1234' as default
      // for seeded demo users (matching seed.ts which hashes 'demo1234').
      async function hashPassword(pw: string | undefined): Promise<string> {
        return argon2.hash(pw ?? 'demo1234');
      }

      // Determine admin user status: 'invited' when no password, 'active' when password present.
      // Invite redemption flow is deferred — inviteToken is stored as a placeholder hash for now.
      let adminPasswordHash: string;
      let adminInviteToken: string | null = null;
      if (adminUser.password) {
        adminPasswordHash = await argon2.hash(adminUser.password);
      } else {
        adminInviteToken = randomUUID();
        adminPasswordHash = await argon2.hash(adminInviteToken); // placeholder; redeemed via invite flow
      }
      const adminStatus = adminUser.password ? 'active' : 'invited';

      // Create spec.users[] first (may include a duplicate of admin — de-duplicated below).
      const createdUserIds = new Set<string>();
      for (const [uid, u] of specUsersById.entries()) {
        // De-duplicate against adminUser: if ids match, skip here and let the admin block handle it.
        if (uid === adminUserId) continue;

        const userPasswordHash = await hashPassword(u.password);
        // User status: explicit value from spec, or derive from password presence.
        const userStatus = u.status ?? (u.password ? 'active' : 'invited');
        const resolvedRoleId = idMode === 'literal' ? u.roleId : `${pfx}${u.roleId}`;
        const resolvedScopeNodeId = u.scopeNodeId
          ? (idMode === 'literal' ? u.scopeNodeId : `${pfx}${u.scopeNodeId}`)
          : null;

        await tx.user.create({
          data: {
            id: uid,
            name: u.name,
            email: u.email,
            initials: u.initials ?? null,
            passwordHash: userPasswordHash,
            roleId: resolvedRoleId,
            scopeType: u.scopeType as Prisma.UserCreateInput['scopeType'],
            scopeLabel: u.scopeLabel ?? null,
            scopeNodeId: resolvedScopeNodeId,
            status: userStatus as Prisma.UserCreateInput['status'],
            tenantId,
            secondary: u.secondary && u.secondary.length > 0
              ? {
                  create: u.secondary.map((s) => ({
                    roleId: s.roleId
                      ? (idMode === 'literal' ? s.roleId : `${pfx}${s.roleId}`)
                      : null,
                    scopeType: s.scopeType as Prisma.UserScopeCreateInput['scopeType'],
                    scopeLabel: s.scopeLabel ?? null,
                    scopeNodeId: s.scopeNodeId
                      ? (idMode === 'literal' ? s.scopeNodeId : `${pfx}${s.scopeNodeId}`)
                      : null,
                    roleLabel: s.roleLabel ?? null,
                    tenantId,
                  })),
                }
              : undefined,
          },
        });
        createdUserIds.add(uid);
      }

      // Create admin user only if not already created via spec.users[].
      if (!createdUserIds.has(adminUserId)) {
        await tx.user.create({
          data: {
            id: adminUserId,
            name: adminUser.name,
            email: adminUser.email,
            passwordHash: adminPasswordHash,
            roleId: `${pfx}${adminUser.roleId}`,
            scopeType: adminUser.scopeType as Prisma.UserCreateInput['scopeType'],
            status: adminStatus as Prisma.UserCreateInput['status'],
            tenantId,
          },
        });
      }

      const adminLoginOrInviteLink = adminInviteToken
        ? `/invite/${adminInviteToken}`
        : `/login?email=${encodeURIComponent(adminUser.email)}`;

      return { tenantId, slug, adminLoginOrInviteLink };
    });

    // ------------------------------------------------------------------
    // 6. Record SUCCEEDED run (outside the data tx so it persists)
    // ------------------------------------------------------------------
    await prisma.provisioningRun.update({
      where: { id: run.id },
      data: { status: 'SUCCEEDED', tenantId: result.tenantId, finishedAt: new Date() },
    });

    return result;
  } catch (err) {
    // ------------------------------------------------------------------
    // 7. Record FAILED run (outside the rolled-back data tx)
    // ------------------------------------------------------------------
    await prisma.provisioningRun
      .update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          error: err instanceof Error ? err.message : String(err),
          finishedAt: new Date(),
        },
      })
      .catch(() => {
        // best-effort — don't mask the original error
      });
    throw err;
  }
}
