/* ============================================================
   provisionTenant — atomic blueprint interpreter (Task 4).
   Turns a BlueprintSpec + runtime inputs into a fully-isolated
   tenant's rows inside one prisma.$transaction.

   Key design decisions:
   - The owner `prisma` client bypasses RLS (no withTenant/appPrisma).
   - Spec-level IDs (org nodes, roles) are prefixed with the tenant slug
     to avoid unique-constraint collisions in the shared schema.
   - TrackDef.key / EntityType.key are namespaced as "<slug>:<key>".
   - StageConfig.@@unique([track,stageId]) is schema-scoped (no tenantId),
     so we upsert to let a later tenant win on the same track+stage combo
     (acceptable until that constraint is widened to include tenantId in a
     future migration).
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

      // Prefix for all spec-local IDs to avoid unique clashes across tenants
      const pfx = `${slug}-`;

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
        const tKey = `${pfx}${track.key}`; // namespaced key avoids TrackDef.key unique clash

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

        // StageConfig — runtime stage-lock table.
        // @@unique([track, stageId]) is not scoped to tenantId in the current schema,
        // so we upsert to avoid duplicate-key errors when multiple tenants share a track+stage.
        const trackEnum = TRACK_ENUM[track.key];
        if (trackEnum) {
          for (const s of track.stages) {
            await tx.stageConfig.upsert({
              where: { track_stageId: { track: trackEnum as Prisma.StageConfigCreateInput['track'], stageId: s.stageId } },
              update: { label: s.label, sla: s.sla, lock: s.lock ?? null, cta: s.cta, tenantId },
              create: {
                track: trackEnum as Prisma.StageConfigCreateInput['track'],
                order: s.order,
                stageId: s.stageId,
                label: s.label,
                sla: s.sla,
                lock: s.lock ?? null,
                cta: s.cta,
                tenantId,
              },
            });
          }
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
        const etKey = `${pfx}${et.key}`; // namespaced key avoids EntityType.key unique clash
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

      // 5i. Admin user
      const adminUser = spec.adminUser;
      let passwordHash: string;
      let inviteToken: string | null = null;

      if (adminUser.password) {
        passwordHash = await argon2.hash(adminUser.password);
      } else {
        inviteToken = randomUUID();
        passwordHash = await argon2.hash(inviteToken); // store hashed token as placeholder
      }

      const userId = `${adminUser.idPrefix}-${slug}`;
      await tx.user.create({
        data: {
          id: userId,
          name: adminUser.name,
          email: adminUser.email,
          passwordHash,
          roleId: `${pfx}${adminUser.roleId}`,
          scopeType: adminUser.scopeType as Prisma.UserCreateInput['scopeType'],
          status: 'active',
          tenantId,
        },
      });

      const adminLoginOrInviteLink = inviteToken
        ? `/invite/${inviteToken}`
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
