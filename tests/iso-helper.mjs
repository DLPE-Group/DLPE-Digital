// Second-tenant fixture for isolation tests. Uses the OWNER prisma (bypasses RLS)
// to seed/tear down tenant B directly; tenant-B *requests* go through the app (il_app+RLS).
import { token } from './helpers.mjs';

export const TENANT_B_ID = 'tenant-iso-b';
export const TENANT_B_USER = 'u-iso-b';
export const TENANT_B_ROLE = 'iso-b-group-admin'; // prefixed admin role → passes requireAdmin via roleIdIsAdmin
export const TENANT_B_TOKEN = () => token(TENANT_B_USER, 'admin@iso-b.test', TENANT_B_ROLE);

// Idempotent: create a minimal but valid tenant B (tenant + admin role + admin user).
export async function ensureTenantB(prisma) {
  await prisma.tenant.upsert({
    where: { id: TENANT_B_ID },
    create: { id: TENANT_B_ID, slug: 'iso-b', name: 'Isolation Tenant B', status: 'ACTIVE', region: 'eu' },
    update: {},
  });
  await prisma.role.upsert({
    where: { id: TENANT_B_ROLE },
    create: { id: TENANT_B_ROLE, name: 'Group Admin', system: true, tracks: [], edit: 'all', desc: 'admin', tenantId: TENANT_B_ID },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: TENANT_B_USER },
    create: { id: TENANT_B_USER, name: 'Tenant B Admin', email: 'admin@iso-b.test', passwordHash: 'x',
      roleId: TENANT_B_ROLE, scopeType: 'group', status: 'active', platformAdmin: false, tenantId: TENANT_B_ID },
    update: {},
  });
}

// FK-safe teardown of tenant B and anything created under it.
export async function destroyTenantB(prisma) {
  const tid = TENANT_B_ID;
  for (const m of ['subscription','userScope','user','fieldRule','stageDef','stageConfig','fieldDef',
                   'entityType','trackDef','crossTrigger','report','dashboardLayout','auditEntry',
                   'integration','invoice','fleetOperator','vehicleTimeline','portalMessage',
                   'dataSharing','rbacVersion','entity','role','orgNode','provisioningRun']) {
    if (prisma[m]?.deleteMany) { try { await prisma[m].deleteMany({ where: { tenantId: tid } }); } catch {} }
  }
  try { await prisma.tenant.delete({ where: { id: tid } }); } catch {}
}
