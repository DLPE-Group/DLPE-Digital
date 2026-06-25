/* ============================================================
   Blueprint templates — the catalogue a fresh platform offers.

   All three are derived from the single source of truth
   (dlpeDemoBlueprint) so structure/roles/tracks/entity-types stay
   in lock-step:

     - dlpe-starter (PUBLISHED) — config only. The default for
       onboarding a real customer: structure + roles + tracks +
       entity-types + field-rules, NO business data, NO staff users.
       Admin email is set per-onboarding in the wizard.

     - dlpe-sample  (PUBLISHED) — starter config + the demo's seed
       business data (pipeline cards, vehicles, portal fleet,
       invoices, integrations, audit), but NO staff users. Reusable:
       cloneable any number of times (the engine namespaces every id
       and reference per tenant). The user-owned extras (reports,
       dashboard) are omitted because they FK to staff users we don't
       create here.

     - dlpe-demo    (DRAFT) — the full demo incl. 9 staff users with
       fixed emails. One-time clone only (User.email is globally
       unique). Re-exported verbatim from dlpeDemoBlueprint.

   Each descriptor is { key, name, status, spec } so the seed and the
   prod bootstrap can upsert them identically.
   ============================================================ */

import type { BlueprintSpec } from '@dlpe/shared';
import { dlpeDemoBlueprint } from './dlpeDemoBlueprint.js';

export type BlueprintStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface BlueprintTemplate {
  key: string;
  name: string;
  status: BlueprintStatus;
  spec: BlueprintSpec;
}

// The per-onboarding admin placeholder — the wizard overrides email (and name).
const PLACEHOLDER_ADMIN: BlueprintSpec['adminUser'] = {
  ...dlpeDemoBlueprint.spec.adminUser,
  idPrefix: 'u-admin',
  name: 'Account Admin',
  email: 'admin@change-me.example',
};

// Config-only base: demo spec without seed business data and without staff users.
const { seed: _demoSeed, users: _demoUsers, ...CONFIG_BASE } = dlpeDemoBlueprint.spec;
void _demoUsers;

const starterSpec = {
  ...CONFIG_BASE,
  adminUser: PLACEHOLDER_ADMIN,
} satisfies BlueprintSpec;

// Sample = config base + seed business data, minus extras that can't be cloned
// repeatedly:
//   - reports.createdById / dashboard.userId FK to staff users we don't create here.
//   - rbacVersions is keyed by a GLOBAL primary key (RbacVersion.v @id, a single-tenant
//     relic), so it can exist for only one tenant — drop it from the reusable sample.
// What remains is the demo's actual business data: pipeline cards, reference vehicles,
// vehicleTimeline, portalFleet (operator + vehicles + invoices), fleetOperators,
// integrations, and audit entries.
const {
  reports: _omitReports,
  dashboard: _omitDashboard,
  rbacVersions: _omitRbacVersions,
  ...sampleExtras
} = _demoSeed.extras;
void _omitReports;
void _omitDashboard;
void _omitRbacVersions;

const sampleSpec = {
  ...CONFIG_BASE,
  adminUser: PLACEHOLDER_ADMIN,
  seed: {
    entities: _demoSeed.entities,
    extras: sampleExtras,
  },
} satisfies BlueprintSpec;

export const starterBlueprint: BlueprintTemplate = {
  key: 'dlpe-starter',
  name: 'Clean starter (config only)',
  status: 'PUBLISHED',
  spec: starterSpec,
};

export const sampleBlueprint: BlueprintTemplate = {
  key: 'dlpe-sample',
  name: 'Sample company (demo data)',
  status: 'PUBLISHED',
  spec: sampleSpec,
};

export const demoBlueprint: BlueprintTemplate = {
  key: dlpeDemoBlueprint.key,
  name: dlpeDemoBlueprint.name,
  status: 'DRAFT',
  spec: dlpeDemoBlueprint.spec,
};

/** All catalogue templates, in display order (PUBLISHED first). */
export const BLUEPRINT_TEMPLATES: BlueprintTemplate[] = [
  starterBlueprint,
  sampleBlueprint,
  demoBlueprint,
];
