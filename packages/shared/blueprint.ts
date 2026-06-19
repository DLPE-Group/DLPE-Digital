/* ============================================================
   BlueprintSpec — declarative provisioning document (v1).
   Consumed by the S1 provisioning engine (Tasks 3–7).
   ============================================================ */

import { z } from 'zod';

export const SPEC_VERSION = 1;

/* ---------- sub-schemas ---------- */

const InputSpec = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['string', 'email', 'locale', 'currency', 'region', 'number', 'boolean']),
  required: z.boolean().default(true),
  default: z.unknown().optional(),
});

// Recursive org node — z.lazy for self-reference
type OrgNodeType = {
  id: string;
  kind: 'group' | 'region' | 'country' | 'company';
  name: string;
  code?: string;
  meta?: unknown;
  settings?: unknown;
  overrides?: unknown;
  children: OrgNodeType[];
};

const OrgNode: z.ZodType<OrgNodeType> = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.enum(['group', 'region', 'country', 'company']),
    name: z.string(),
    code: z.string().optional(),
    meta: z.unknown().optional(),
    settings: z.unknown().optional(),
    overrides: z.unknown().optional(),
    children: z.array(OrgNode),
  })
);

const RoleSpec = z.object({
  id: z.string(),
  name: z.string(),
  system: z.boolean(),
  tracks: z.array(z.string()),
  edit: z.string(),
  desc: z.string(),
});

const FieldRuleSpec = z.object({
  roleId: z.string(),
  dataTypeId: z.string(),
  fieldId: z.string(),
  scope: z.string().default('ANY'),
  visible: z.boolean(),
  editable: z.boolean(),
  masked: z.boolean(),
  note: z.string().optional(),
});

const StageDefSpec = z.object({
  stageId: z.string(),
  label: z.string(),
  sla: z.number(),
  lock: z.string().optional(),
  cta: z.string(),
  order: z.number(),
});

const TrackSpec = z.object({
  key: z.string(),
  label: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
  order: z.number(),
  builtin: z.boolean(),
  stages: z.array(StageDefSpec),
});

const FieldDefSpec = z.object({
  key: z.string(),
  label: z.string(),
  category: z.string().optional(),
  dataKind: z.string(),
  order: z.number(),
  builtin: z.boolean(),
});

const EntityTypeSpec = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(['pipeline', 'reference']),
  trackKey: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  order: z.number(),
  builtin: z.boolean(),
  fields: z.array(FieldDefSpec),
});

const CrossTriggerSpec = z.object({
  whenTrack: z.string(),
  whenStage: z.string(),
  thenTrack: z.string(),
  thenStage: z.string(),
  note: z.string(),
});

const SeedSpec = z.object({
  entities: z.array(z.unknown()).optional(),
  extras: z.unknown().optional(),
}).optional();

const BrandingSpec = z.object({
  name: z.string().optional(),
  primaryColor: z.string().optional(),
  logo: z.string().optional(),
}).optional();

const IntegrationSpec = z.array(z.unknown()).optional();

const AdminUserSpec = z.object({
  idPrefix: z.string(),
  name: z.string(),
  email: z.string().email(),
  roleId: z.string(),
  scopeType: z.string(),
  password: z.string().optional(),
});

/** A user entry inside spec.users[] — seeded alongside the admin user. */
export const UserSpec = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  initials: z.string().optional(),
  roleId: z.string(),
  scopeType: z.string(),
  scopeLabel: z.string().optional(),
  scopeNodeId: z.string().optional(),
  status: z.enum(['active', 'invited', 'disabled']).optional(),
  password: z.string().optional(),
  platformAdmin: z.boolean().optional(),
  secondary: z.array(z.object({
    roleId: z.string().optional(),
    scopeType: z.string(),
    scopeLabel: z.string().optional(),
    scopeNodeId: z.string().optional(),
    roleLabel: z.string().optional(),
  })).optional(),
});

export type UserSpec = z.infer<typeof UserSpec>;

/* ---------- BlueprintSpec ---------- */

export const BlueprintSpec = z.object({
  specVersion: z.literal(SPEC_VERSION),
  defaultPlanKey: z.string().optional(),
  inputs: z.array(InputSpec),
  orgStructure: OrgNode,
  roles: z.array(RoleSpec),
  fieldRules: z.array(FieldRuleSpec),
  tracks: z.array(TrackSpec),
  entityTypes: z.array(EntityTypeSpec),
  crossTriggers: z.array(CrossTriggerSpec),
  seed: SeedSpec,
  branding: BrandingSpec,
  integrations: IntegrationSpec,
  adminUser: AdminUserSpec,
  users: z.array(UserSpec).optional(),
});

export type BlueprintSpec = z.infer<typeof BlueprintSpec>;
