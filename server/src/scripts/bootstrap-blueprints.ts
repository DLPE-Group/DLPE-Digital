/* ============================================================
   bootstrap-blueprints — ensure the platform's blueprint catalogue
   exists in a fresh (production) database.

   The full demo seed (prisma/seed.ts) creates these too, but it needs
   tsx + src/ and can't run in the slim runtime image. This script is
   compiled (dist/scripts/bootstrap-blueprints.js) so it runs in prod
   via the POST_DEPLOY job, right after bootstrap-admin.

   It upserts blueprint DEFINITIONS only (templates) — it does NOT
   provision any tenant. Spinning up a company stays a control-plane
   action. Idempotent: upsert by key, safe to re-run on every deploy.

   Uses the OWNER connection (DATABASE_URL), which bypasses RLS by
   ownership (Blueprint is a platform-level table with no tenantId).

   Run:  node dist/scripts/bootstrap-blueprints.js
   or:   npm run bootstrap:blueprints
   ============================================================ */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { BLUEPRINT_TEMPLATES } from '../domain/provisioning/templates.js';

async function main(): Promise<void> {
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
  console.log(`✅ Blueprint catalogue ready (${BLUEPRINT_TEMPLATES.length} templates).`);
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
