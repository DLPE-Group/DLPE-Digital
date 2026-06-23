/* ============================================================
   bootstrap-admin — create the FIRST platform-admin in a fresh
   (production) database, WITHOUT seeding any demo data.

   Runnable in the slim runtime image (compiled to
   dist/scripts/bootstrap-admin.js, unlike the demo seed which
   needs src/ + tsx):  `node dist/scripts/bootstrap-admin.js`
   or via the npm alias:  `npm run bootstrap:admin`.

   Idempotent (upserts). Uses the OWNER connection (DATABASE_URL),
   which bypasses RLS by ownership — so it works on managed Postgres
   where the admin role is not a superuser.

   Required env:
     BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD
   Optional env:
     BOOTSTRAP_ADMIN_NAME   (default 'Platform Admin')
     BOOTSTRAP_TENANT_SLUG  (default 'platform')
     BOOTSTRAP_TENANT_NAME  (default 'Platform')
   ============================================================ */
import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

async function main(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error(
      'FATAL: BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.\n' +
        'Example:\n' +
        '  BOOTSTRAP_ADMIN_EMAIL=you@company.com BOOTSTRAP_ADMIN_PASSWORD=... npm run bootstrap:admin',
    );
    process.exit(1);
  }

  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Platform Admin';
  const tenantSlug = (process.env.BOOTSTRAP_TENANT_SLUG?.trim() || 'platform').toLowerCase();
  const tenantName = process.env.BOOTSTRAP_TENANT_NAME?.trim() || 'Platform';

  const tenantId = `tenant-${tenantSlug}`;
  // `<slug>-group-admin` is recognised by requireAdmin (tenant-portable) AND is
  // platform-scoped; platformAdmin=true is what grants the control plane.
  const roleId = `${tenantSlug}-group-admin`;
  const userId = `u-admin-${tenantSlug}`;
  const passwordHash = await argon2.hash(password);

  await prisma.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      slug: tenantSlug,
      name: tenantName,
      status: 'ACTIVE' as Prisma.TenantCreateInput['status'],
      region: 'eu',
    },
    update: { name: tenantName, status: 'ACTIVE' as Prisma.TenantUpdateInput['status'] },
  });

  await prisma.role.upsert({
    where: { id: roleId },
    create: {
      id: roleId,
      name: 'Group Admin',
      system: true,
      tracks: [],
      edit: 'all',
      desc: 'Platform administrator',
      tenantId,
    },
    update: {},
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      id: userId,
      name,
      email,
      passwordHash,
      roleId,
      scopeType: 'group' as Prisma.UserCreateInput['scopeType'],
      status: 'active' as Prisma.UserCreateInput['status'],
      platformAdmin: true,
      tenantId,
    },
    update: { name, passwordHash, platformAdmin: true, status: 'active' as Prisma.UserUpdateInput['status'] },
  });

  // The S0 backfill migration (20260618180000) unconditionally inserts a
  // 'tenant-dlpe-demo' row to anchor pre-tenancy data. On a fresh production DB there
  // is nothing to anchor, so it lingers as an empty placeholder that would clutter the
  // control plane. Remove it — but ONLY when it has no users (so a real SEEDED demo,
  // which has staff users, is never deleted). Best-effort: any FK dependents → leave it.
  const demoUsers = await prisma.user.count({ where: { tenantId: 'tenant-dlpe-demo' } });
  if (demoUsers === 0) {
    try {
      await prisma.tenant.delete({ where: { id: 'tenant-dlpe-demo' } });
      console.log("   Removed the empty 'dlpe-demo' placeholder tenant (S0 backfill artifact).");
    } catch {
      /* has dependent rows — a real/used tenant; leave it untouched */
    }
  }

  console.log(`✅ Platform admin ready: ${user.email} (platformAdmin=${user.platformAdmin}) in tenant '${tenantSlug}'.`);
  console.log('   Log in, open the Control plane, and provision real customers. No demo data was created.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('bootstrap-admin failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
