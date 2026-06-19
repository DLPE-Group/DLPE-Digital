/* ============================================================
   Intelligence Layer — Phase 1 seed (Task 8 rewire).
   Reproduces today's demo data by provisioning the dlpe-demo
   blueprint via provisionTenant (idMode:'literal') so every
   row id stays verbatim and the 90-test suite stays green.

   Idempotent: wipes the seeded tables (deleteMany) then re-creates.
   NOTE: cards o1 / f1 are NOT seeded — they only appear after the
   Brussels cascade. s5 seeds awaitingSign:true, stageId:'contract'.
   ============================================================ */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  DATA_TYPES,
  FIELD_CATEGORIES,
} from '@dlpe/shared';
import { dlpeDemoBlueprint, demoInputs, DEMO_TENANT_ID } from '../src/domain/provisioning/dlpeDemoBlueprint.js';
import { provisionTenant } from '../src/domain/provisioning/provisionTenant.js';
import { SharedDbTarget } from '../src/domain/provisioning/target.js';

const prisma = new PrismaClient();

const COUNTRY_DEFAULTS = {
  NL: { vat: '21%', currency: 'EUR', peppol: 'BIS Billing 3.0 · NL profile', languages: 'Dutch', fiscalYear: '1 Jan' },
  BE: { vat: '21%', currency: 'EUR', peppol: 'BIS Billing 3.0 · BE profile', languages: 'Dutch · French', fiscalYear: '1 Jan' },
  LU: { vat: '17%', currency: 'EUR', peppol: 'BIS Billing 3.0 · standard', languages: 'French · German', fiscalYear: '1 Jan' },
  DE: { vat: '19%', currency: 'EUR', peppol: 'BIS Billing 3.0 · DE profile', languages: 'German', fiscalYear: '1 Jan' },
};

const PLANS = [
  { key: 'starter',    name: 'Starter',    tier: 1, priceMonthly: 4900,  entitlements: { features: ['reports'], limits: { maxUsers: 10 } } },
  { key: 'pro',        name: 'Pro',        tier: 2, priceMonthly: 14900, entitlements: { features: ['reports', 'api_access'], limits: { maxUsers: 50 } } },
  { key: 'enterprise', name: 'Enterprise', tier: 3, priceMonthly: 0,     entitlements: { features: ['reports', 'api_access', 'sso', 'custom_domain'], limits: {} } },
];

async function main() {
  // Wipe (idempotent) — order respects FK constraints.
  // Subscription must be deleted before Tenant (FK); Plan can be deleted anytime (no tenant FK).
  await prisma.auditCascade.deleteMany();
  await prisma.auditEntry.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.vehicleTimeline.deleteMany();
  await prisma.report.deleteMany();
  await prisma.dashboardLayout.deleteMany();
  await prisma.session.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.fieldDef.deleteMany();
  await prisma.entityType.deleteMany();
  await prisma.stageDef.deleteMany();
  await prisma.trackDef.deleteMany();
  await prisma.fieldRule.deleteMany();
  await prisma.rbacVersion.deleteMany();
  await prisma.stageConfig.deleteMany();
  await prisma.crossTrigger.deleteMany();
  await prisma.userScope.deleteMany();
  await prisma.user.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.fleetOperator.deleteMany();
  await prisma.dataSharing.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.role.deleteMany();
  await prisma.countryDefaults.deleteMany();
  await prisma.orgNode.deleteMany();
  await prisma.subscription.deleteMany();  // before tenant (FK)
  await prisma.provisioningRun.deleteMany();
  await prisma.blueprint.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.plan.deleteMany();           // no tenant FK — safe after subscription wipe

  // Country defaults — NOT tenant-scoped; global reference table.
  for (const [code, d] of Object.entries(COUNTRY_DEFAULTS)) {
    await prisma.countryDefaults.create({ data: { code, ...d } });
  }

  // Plans — global pricing catalogue (platform-level, no tenantId).
  for (const p of PLANS) {
    await prisma.plan.upsert({ where: { key: p.key }, update: p, create: p });
  }

  // Upsert the dlpe-demo Blueprint row (PUBLISHED).
  const bp = await prisma.blueprint.upsert({
    where: { key: dlpeDemoBlueprint.key },
    create: {
      key: dlpeDemoBlueprint.key,
      name: dlpeDemoBlueprint.name,
      version: dlpeDemoBlueprint.spec.specVersion,
      status: 'PUBLISHED',
      spec: dlpeDemoBlueprint.spec as unknown as Prisma.InputJsonValue,
    },
    update: {
      name: dlpeDemoBlueprint.name,
      version: dlpeDemoBlueprint.spec.specVersion,
      status: 'PUBLISHED',
      spec: dlpeDemoBlueprint.spec as unknown as Prisma.InputJsonValue,
    },
  });

  // Provision the demo tenant via the engine (idMode:'literal' keeps verbatim IDs).
  await provisionTenant({
    blueprint: { id: bp.id, spec: dlpeDemoBlueprint.spec },
    inputs: demoInputs,
    target: new SharedDbTarget(),
    tenantId: DEMO_TENANT_ID,
    idempotencyKey: 'seed-dlpe-demo',
    idMode: 'literal',
    prismaClient: prisma,
  });

  // Demo tenant subscription — enterprise plan, ACTIVE.
  const enterprisePlan = await prisma.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
  await prisma.subscription.upsert({
    where: { tenantId: DEMO_TENANT_ID },
    update: {},
    create: {
      tenantId: DEMO_TENANT_ID,
      planId: enterprisePlan.id,
      status: 'ACTIVE',
      provider: 'simulated',
      currentPeriodEnd: null,
    },
  });

  // Sanity: ensure DATA_TYPES + FIELD_CATEGORIES catalogues are referenced.
  void DATA_TYPES;
  void FIELD_CATEGORIES;

  const counts = {
    orgNodes: await prisma.orgNode.count(),
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    entities: await prisma.entity.count(),
    fieldRules: await prisma.fieldRule.count(),
    stageConfig: await prisma.stageConfig.count(),
    crossTriggers: await prisma.crossTrigger.count(),
    integrations: await prisma.integration.count(),
    auditEntries: await prisma.auditEntry.count(),
    reports: await prisma.report.count(),
  };
  console.log('Seed complete:', JSON.stringify(counts, null, 2));
  console.log('Login: m.weber@group.eu / demo1234 (and r.mertens@group.eu, l.pieters@group.eu, etc.)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
