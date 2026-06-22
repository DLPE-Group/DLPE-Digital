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

import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { prisma as defaultPrisma } from '../../prisma.js';
import type { BlueprintSpec as BlueprintSpecType } from '@dlpe/shared';
import { TRACK_KEY_FROM_ENUM } from '@dlpe/shared';
import type { ProvisioningTarget } from './target.js';
import { slugify, validateInputs, resolveSlugName, resolvePlanKey } from './derive.js';
import { Prisma, PrismaClient } from '@prisma/client';
import { cardToEntityCreate, vehicleToEntityCreate, type CardSeed, type VehicleSeed, type MetaCtx } from '../backfill.js';
import { SimulatedBillingProvider } from '../billing/provider.js';

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
  /** Override the blueprint's admin user name/email (per-onboarding). Field-wise merge. */
  adminOverride?: { name?: string; email?: string };
  /** Override the default subscription plan key (else spec.defaultPlanKey ?? 'starter'). */
  planKey?: string;
  /** Optional prisma client override — defaults to the owner (bypass-RLS) client.
   *  Useful in tests to point at the test database. */
  prismaClient?: PrismaClient;
}

// ---------- helpers ----------

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
  const effectiveAdmin = {
    ...spec.adminUser,
    ...(args.adminOverride?.name ? { name: args.adminOverride.name } : {}),
    ...(args.adminOverride?.email ? { email: args.adminOverride.email } : {}),
  };
  const idMode = args.idMode ?? 'prefixed';

  // ------------------------------------------------------------------
  // 1. Validate inputs against spec.inputs
  // ------------------------------------------------------------------
  const inputCheck = validateInputs(spec, inputs);
  if (!inputCheck.ok) {
    throw new Error(`Invalid inputs: ${inputCheck.missing.join(', ')}`);
  }

  // ------------------------------------------------------------------
  // 2. Derive slug + name + region
  // ------------------------------------------------------------------
  const { slug, name, region } = resolveSlugName(spec, inputs);

  // ------------------------------------------------------------------
  // 3. Idempotency guard — short-circuit if SUCCEEDED run exists
  // ------------------------------------------------------------------
  const iKey = idempotencyKey ?? `auto-${randomUUID()}`;

  if (idempotencyKey) {
    const existing = await prisma.provisioningRun.findUnique({ where: { idempotencyKey: iKey } });
    if (existing?.status === 'SUCCEEDED' && existing.tenantId) {
      const savedSteps = existing.steps as Record<string, unknown> | null;
      const savedLink = typeof savedSteps?.adminLoginOrInviteLink === 'string'
        ? savedSteps.adminLoginOrInviteLink
        : `/login?email=${encodeURIComponent(effectiveAdmin.email)}`;
      return {
        tenantId: existing.tenantId,
        slug: existing.slug,
        adminLoginOrInviteLink: savedLink,
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

  // Upsert a PENDING ProvisioningRun — handles both new and PENDING/FAILED retries
  const run = await prisma.provisioningRun.upsert({
    where: { idempotencyKey: iKey },
    create: { idempotencyKey: iKey, blueprintId, slug, status: 'PENDING' },
    update: { status: 'PENDING', error: null, finishedAt: null, blueprintId, slug },
  });

  // ------------------------------------------------------------------
  // 4b. Pre-compute argon2 hashes OUTSIDE the transaction (CPU-slow ~64ms each)
  // ------------------------------------------------------------------

  // Admin user hash
  let adminPasswordHashPre: string;
  let adminInviteTokenPre: string | null = null;
  if (effectiveAdmin.password) {
    adminPasswordHashPre = await argon2.hash(effectiveAdmin.password);
  } else {
    adminInviteTokenPre = randomUUID();
    adminPasswordHashPre = await argon2.hash(adminInviteTokenPre); // placeholder; redeemed via invite flow
  }

  // spec.users[] hashes: users with no password get 'demo1234' default (matching seed.ts)
  const precomputedUserHashes = new Map<string, string>();
  for (const u of spec.users ?? []) {
    precomputedUserHashes.set(u.id, await argon2.hash(u.password ?? 'demo1234'));
  }

  // ------------------------------------------------------------------
  // 5. Atomic data transaction
  // ------------------------------------------------------------------
  let result: ProvisioningResult;
  try {
    result = await prisma.$transaction(async (tx) => {
      // 5a. Create the Tenant — guard slug uniqueness with a structured error so
      //     callers can distinguish "slug taken by another key" from other failures.
      let ctx: { tenantId: string; slug: string };
      try {
        ctx = await target.prepare(
          { slug, name, region, tenantId: args.tenantId },
          tx,
        );
      } catch (prepErr) {
        if (
          prepErr instanceof Prisma.PrismaClientKnownRequestError &&
          prepErr.code === 'P2002'
        ) {
          throw new Error(`slug already in use: ${slug}`);
        }
        throw prepErr;
      }
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

      // 5h. Seed — pipeline + reference entities + rich demo extras
      // Build a MetaCtx from the just-created rows so cardToEntityCreate / vehicleToEntityCreate
      // can resolve track IDs and entity type IDs.
      const metaCtx: MetaCtx = {
        trackIdByKey: trackDefIdByKey,
        typeIdByKey: (() => {
          // Collect entity type rows created in 5g: spec.entityTypes entries keyed by their
          // original spec key (before prefix). We need to re-fetch them from the tx.
          // Since we already wrote them, we can build a reverse map from what we know.
          // In literal mode: etKey = et.key. In prefixed mode: etKey = `${pfx}${et.key}`.
          // We re-query the DB to get the actual UUIDs (they were created with cuid()).
          return {}; // populated async below
        })(),
        tenantFor: (_companyId: string | null) => tenantId,
        tenantId,
      };

      // Populate typeIdByKey from the just-inserted EntityType rows
      for (const et of spec.entityTypes) {
        const etKey = idMode === 'literal' ? et.key : `${pfx}${et.key}`;
        const row = await tx.entityType.findUnique({ where: { key: etKey } });
        if (row) metaCtx.typeIdByKey[et.key] = row.id;
      }

      // Pipeline + reference entities (CardSeed-shaped objects in spec.seed.entities)
      if (spec.seed?.entities && spec.seed.entities.length > 0) {
        for (const e of spec.seed.entities as Array<Record<string, unknown>>) {
          const track = typeof e.track === 'string' ? e.track : '';
          const trackKey: string = TRACK_KEY_FROM_ENUM[track] ?? track.toLowerCase();
          const isVehicle = trackKey === 'vehicle' || (typeof e.plate === 'string');

          if (isVehicle) {
            // Reference entity (vehicle)
            const v: VehicleSeed = {
              id: typeof e.id === 'string' ? e.id : undefined,
              plate: typeof e.plate === 'string' ? e.plate : String(e.id ?? ''),
              model: typeof e.model === 'string' ? e.model : null,
              vin: typeof e.vin === 'string' ? e.vin : null,
              operator: typeof e.operator === 'string' ? e.operator : null,
              status: typeof e.status === 'string' ? e.status : null,
              statusLabel: typeof e.statusLabel === 'string' ? e.statusLabel : null,
              note: typeof e.note === 'string' ? e.note : null,
              companyId: typeof e.companyId === 'string' ? e.companyId : null,
            };
            const data = vehicleToEntityCreate(v, metaCtx);
            // Namespace the entity id per-tenant in prefixed mode — covers both the
            // explicit id and the `veh-<plate>` fallback — so re-provisioning a
            // seed-bearing blueprint can't clash on the global Entity.id PK.
            if (idMode === 'prefixed') data.id = `${pfx}${data.id}`;
            await tx.entity.create({ data });
          } else {
            // Pipeline entity (CardSeed-shaped)
            const c: CardSeed = {
              id: typeof e.id === 'string' ? (idMode === 'literal' ? e.id : `${pfx}${e.id}`) : randomUUID(),
              companyId: typeof e.companyId === 'string' ? e.companyId : null,
              track,
              type: typeof e.type === 'string' ? e.type : 'UNKNOWN',
              customer: typeof e.customer === 'string' ? e.customer : '',
              value: typeof e.value === 'number' ? e.value : null,
              vehicle: typeof e.vehicle === 'string' ? e.vehicle : null,
              sub: typeof e.sub === 'string' ? e.sub : '',
              stageId: typeof e.stageId === 'string' ? e.stageId : '',
              stageName: typeof e.stageName === 'string' ? e.stageName : '',
              days: typeof e.days === 'number' ? e.days : 0,
              daysLabel: typeof e.daysLabel === 'string' ? e.daysLabel : null,
              owner: typeof e.owner === 'string' ? e.owner : '',
              status: typeof e.status === 'string' ? e.status : 'normal',
              cta: typeof e.cta === 'string' ? e.cta : '',
              sources: Array.isArray(e.sources) ? (e.sources as string[]) : [],
              awaitingSign: e.awaitingSign === true,
            };
            const data = cardToEntityCreate(c, metaCtx);
            // In literal mode, id from CardSeed is already verbatim; in prefixed it is prefixed above
            await tx.entity.create({ data });
          }
        }
      }

      // 5h-extras: rich demo business data from spec.seed.extras
      const extras = spec.seed?.extras as Record<string, unknown> | undefined;
      if (extras) {
        // Vehicle timeline
        if (extras.vehicleTimeline) {
          const vt = extras.vehicleTimeline as Record<string, unknown>;
          await tx.vehicleTimeline.create({
            data: {
              customer: String(vt.customer ?? ''),
              vehicle: String(vt.vehicle ?? ''),
              contractValue: typeof vt.contractValue === 'number' ? vt.contractValue : null,
              account: typeof vt.account === 'string' ? vt.account : null,
              tenantId,
              events: Array.isArray(vt.events) ? {
                create: (vt.events as Array<Record<string, unknown>>).map((ev, i) => ({
                  order: i,
                  track: String(ev.track ?? ''),
                  stage: String(ev.stage ?? ''),
                  detail: typeof ev.detail === 'string' ? ev.detail : null,
                  date: typeof ev.date === 'string' ? ev.date : null,
                  owner: typeof ev.owner === 'string' ? ev.owner : null,
                  state: typeof ev.state === 'string' ? ev.state : null,
                  docs: Array.isArray(ev.docs) ? (ev.docs as string[]) : [],
                  tenantId,
                })),
              } : undefined,
            },
          });
        }

        // Portal fleet (FleetOperator + vehicle entities + invoices)
        if (extras.portalFleet) {
          const pf = extras.portalFleet as Record<string, unknown>;
          const operatorCompanyId = typeof pf.operatorCompanyId === 'string' ? pf.operatorCompanyId : null;

          // Primary fleet operator
          await tx.fleetOperator.create({
            data: {
              name: String(pf.operator ?? ''),
              contact: typeof pf.contact === 'string' ? pf.contact : null,
              companyId: operatorCompanyId,
              meta: { messages: 3 },
              tenantId,
            },
          });

          // Portal vehicles as Entity reference rows
          if (Array.isArray(pf.vehicles)) {
            for (const v of pf.vehicles as Array<Record<string, unknown>>) {
              const vs: VehicleSeed = {
                plate: String(v.plate ?? ''),
                model: typeof v.model === 'string' ? v.model : null,
                operator: String(pf.operator ?? ''),
                status: typeof v.status === 'string' ? v.status : null,
                statusLabel: typeof v.statusLabel === 'string' ? v.statusLabel : null,
                note: typeof v.note === 'string' ? v.note : null,
                companyId: typeof v.companyId === 'string' ? v.companyId : operatorCompanyId,
              };
              const vData = vehicleToEntityCreate(vs, metaCtx);
              // Portal vehicles get a `veh-<plate>` id by default — namespace it per
              // tenant in prefixed mode to avoid clashing with another tenant's vehicles.
              if (idMode === 'prefixed') vData.id = `${pfx}${vData.id}`;
              await tx.entity.create({ data: vData });
            }
          }

          // Invoices
          if (Array.isArray(pf.invoices)) {
            for (const inv of pf.invoices as Array<Record<string, unknown>>) {
              await tx.invoice.create({
                data: {
                  ref: idMode === 'prefixed' ? `${pfx}${String(inv.ref ?? randomUUID())}` : String(inv.ref ?? randomUUID()),
                  value: typeof inv.value === 'number' ? inv.value : null,
                  due: typeof inv.due === 'string' ? inv.due : null,
                  status: typeof inv.status === 'string' ? inv.status : null,
                  companyId: operatorCompanyId,
                  tenantId,
                },
              });
            }
          }
        }

        // Additional fleet operators from payload (blueprint-defined, not hardcoded)
        if (Array.isArray(extras.fleetOperators)) {
          for (const fo of extras.fleetOperators as Array<Record<string, unknown>>) {
            await tx.fleetOperator.create({
              data: {
                name: String(fo.name ?? ''),
                contact: typeof fo.contact === 'string' ? fo.contact : null,
                companyId: typeof fo.companyId === 'string' ? fo.companyId : null,
                meta: (fo.meta as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                tenantId,
              },
            });
          }
        }

        // Integrations
        if (Array.isArray(extras.integrations)) {
          for (const integ of extras.integrations as Array<Record<string, unknown>>) {
            await tx.integration.create({
              data: {
                id: idMode === 'prefixed' ? `${pfx}${String(integ.id ?? randomUUID())}` : String(integ.id ?? randomUUID()),
                name: String(integ.name ?? ''),
                kind: String(integ.kind ?? ''),
                direction: String(integ.direction ?? 'inbound'),
                logo: String(integ.logo ?? ''),
                status: String(integ.status ?? 'idle'),
                lastSync: typeof integ.lastSync === 'string' ? integ.lastSync : null,
                throughput: typeof integ.throughput === 'string' ? integ.throughput : null,
                latency: typeof integ.latency === 'string' ? integ.latency : null,
                desc: typeof integ.desc === 'string' ? integ.desc : null,
                nango: false,
                transforms: 0,
                tenantId,
              },
            });
          }
        }

        // Audit entries + cascades
        if (Array.isArray(extras.audit)) {
          for (const a of extras.audit as Array<Record<string, unknown>>) {
            await tx.auditEntry.create({
              data: {
                day: typeof a.day === 'string' ? a.day : null,
                time: typeof a.time === 'string' ? a.time : null,
                actor: String(a.actor ?? ''),
                actorRole: typeof a.actorRole === 'string' ? a.actorRole : null,
                verb: String(a.verb ?? ''),
                target: typeof a.target === 'string' ? a.target : null,
                track: String(a.track ?? ''),
                kind: typeof a.kind === 'string' ? a.kind : 'normal',
                icon: typeof a.icon === 'string' ? a.icon : null,
                isSystem: a.isSystem === true,
                tenantId,
                cascades: Array.isArray(a.cascades) && (a.cascades as unknown[]).length > 0 ? {
                  create: (a.cascades as Array<Record<string, unknown>>).map((c, i) => ({
                    order: i,
                    track: String(c.track ?? ''),
                    text: String(c.text ?? ''),
                    tenantId,
                  })),
                } : undefined,
              },
            });
          }
        }

      }

      // 5i. Users — spec.users[] + admin user

      // Derive admin user id based on id mode.
      // In prefixed mode: <idPrefix>-<slug>. In literal mode: idPrefix verbatim.
      const adminUser = effectiveAdmin;
      const adminUserId = idMode === 'literal'
        ? adminUser.idPrefix
        : `${adminUser.idPrefix}-${slug}`;

      // Collect the set of user ids to create from spec.users[] (after id-mode applied).
      const specUsersById = new Map<string, NonNullable<BlueprintSpecType['users']>[number]>();
      for (const u of spec.users ?? []) {
        const uid = idMode === 'literal' ? u.id : `${pfx}${u.id}`;
        specUsersById.set(uid, u);
      }

      // Use pre-computed hashes (computed outside the tx to avoid holding it open).
      const adminPasswordHash = adminPasswordHashPre;
      const adminInviteToken = adminInviteTokenPre;
      const adminStatus = adminUser.password ? 'active' : 'invited';

      // Create spec.users[] first (may include a duplicate of admin — de-duplicated below).
      const createdUserIds = new Set<string>();
      for (const [uid, u] of specUsersById.entries()) {
        // De-duplicate against adminUser: if ids match, skip here and let the admin block handle it.
        if (uid === adminUserId) continue;

        // Look up pre-computed hash (key is original spec id before prefix).
        const userPasswordHash = precomputedUserHashes.get(u.id)!;
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
            platformAdmin: u.platformAdmin ?? false,
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
        // Inherit platformAdmin from the matching spec.users[] entry (if present).
        const adminSpecEntry = specUsersById.get(adminUserId);
        await tx.user.create({
          data: {
            id: adminUserId,
            name: adminUser.name,
            email: adminUser.email,
            passwordHash: adminPasswordHash,
            roleId: `${pfx}${adminUser.roleId}`,
            scopeType: adminUser.scopeType as Prisma.UserCreateInput['scopeType'],
            status: adminStatus as Prisma.UserCreateInput['status'],
            platformAdmin: adminSpecEntry?.platformAdmin ?? false,
            tenantId,
          },
        });
      }

      const adminLoginOrInviteLink = adminInviteToken
        ? `/invite/${adminInviteToken}`
        : `/login?email=${encodeURIComponent(adminUser.email)}`;

      // 5j. User-dependent extras (reports, dashboard, rbacVersions) — written after users exist
      const extrasForUsers = spec.seed?.extras as Record<string, unknown> | undefined;
      if (extrasForUsers) {
        // Reports (FK: createdById → User)
        if (Array.isArray(extrasForUsers.reports)) {
          for (const r of extrasForUsers.reports as Array<Record<string, unknown>>) {
            const createdById = typeof r.createdById === 'string' ? r.createdById : null;
            await tx.report.create({
              data: {
                title: String(r.title ?? ''),
                spec: r.spec as Prisma.InputJsonValue,
                prose: r.prose as Prisma.InputJsonValue,
                when: String(r.when ?? ''),
                createdById,
                tenantId,
              },
            });
          }
        }

        // Dashboard layout (FK: userId → User)
        if (extrasForUsers.dashboard) {
          const dash = extrasForUsers.dashboard as Record<string, unknown>;
          const dashUserId = typeof dash.userId === 'string' ? dash.userId : null;
          if (dashUserId) {
            await tx.dashboardLayout.create({
              data: {
                userId: dashUserId,
                charts: dash.charts as Prisma.InputJsonValue,
                tenantId,
              },
            });
          }
        }

        // RBAC versions (tenant-scoped, no user FK)
        if (Array.isArray(extrasForUsers.rbacVersions)) {
          await tx.rbacVersion.createMany({
            data: (extrasForUsers.rbacVersions as Array<Record<string, unknown>>).map((rv) => ({
              v: typeof rv.v === 'number' ? rv.v : 0,
              when: String(rv.when ?? ''),
              actor: String(rv.actor ?? ''),
              note: String(rv.note ?? ''),
              tenantId,
            })),
          });
        }
      }

      return { tenantId, slug, adminLoginOrInviteLink };
    });

    // ------------------------------------------------------------------
    // 6. Record SUCCEEDED run (outside the data tx so it persists)
    // ------------------------------------------------------------------
    await prisma.provisioningRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCEEDED',
        tenantId: result.tenantId,
        finishedAt: new Date(),
        steps: { adminLoginOrInviteLink: result.adminLoginOrInviteLink },
      },
    });

    // ------------------------------------------------------------------
    // 6b. Assign default subscription (outside tx — tenant must already exist)
    // Uses the same prisma client so tests can point it at the test DB.
    // Guard: if the plan key doesn't resolve, skip (don't fail provisioning).
    // createSubscription upserts by tenantId so this is idempotent.
    // ------------------------------------------------------------------
    try {
      const bp = new SimulatedBillingProvider(prisma);
      await bp.createSubscription({
        tenantId: result.tenantId,
        planKey: resolvePlanKey(spec, args.planKey),
        status: 'TRIALING',
      });
    } catch (subErr) {
      console.warn(
        `[provisionTenant] subscription assignment skipped for tenant ${result.tenantId}:`,
        subErr instanceof Error ? subErr.message : String(subErr),
      );
    }

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
