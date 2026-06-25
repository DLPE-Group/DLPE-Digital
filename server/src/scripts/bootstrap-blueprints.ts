/* ============================================================
   bootstrap-blueprints — ensure the platform's reference catalogue
   (subscription plans + blueprint templates) exists in a fresh
   (production) database.

   The full demo seed (prisma/seed.ts) creates these too, but it needs
   tsx + src/ and can't run in the slim runtime image. This script is
   compiled (dist/scripts/bootstrap-blueprints.js) so it runs in prod
   via the POST_DEPLOY job, right after bootstrap-admin.

   It upserts platform reference data only — plans + blueprint
   DEFINITIONS. It does NOT provision any tenant; spinning up a company
   stays a control-plane action. Idempotent: upsert by key, safe to
   re-run on every deploy.

   Uses the OWNER connection (DATABASE_URL), which bypasses RLS by
   ownership (Plan and Blueprint are platform-level tables, no tenantId).

   Run:  node dist/scripts/bootstrap-blueprints.js
   or:   npm run bootstrap:blueprints
   ============================================================ */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { BLUEPRINT_TEMPLATES } from '../domain/provisioning/templates.js';
import { PLATFORM_PLANS } from '../domain/billing/plans.js';

async function main(): Promise<void> {
  // Subscription plans — the wizard's plan dropdown reads these; provisionTenant
  // attaches the chosen (or blueprint-default) plan as the tenant's subscription.
  for (const p of PLATFORM_PLANS) {
    await prisma.plan.upsert({ where: { key: p.key }, create: p, update: p });
    console.log(`   ✓ plan '${p.key}' (tier ${p.tier}) ready.`);
  }

  for (const t of BLUEPRINT_TEMPLATES) {
    await prisma.blueprint.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        name: t.name,
        version: t.spec.specVersion,
        status: t.status,
        spec: t.spec as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: t.name,
        version: t.spec.specVersion,
        status: t.status,
        spec: t.spec as unknown as Prisma.InputJsonValue,
      },
    });
    console.log(`   ✓ blueprint '${t.key}' (${t.status}) ready.`);
  }
  console.log(`✅ Catalogue ready: ${PLATFORM_PLANS.length} plans, ${BLUEPRINT_TEMPLATES.length} blueprint templates.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('bootstrap-blueprints failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
