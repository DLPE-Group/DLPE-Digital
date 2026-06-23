-- Runtime tenant isolation on MANAGED Postgres (e.g. DigitalOcean): the admin/owner
-- role that runs migrations + provisioning is NOT a superuser there, and FORCE ROW
-- LEVEL SECURITY subjects even the table OWNER to the policies. That breaks the
-- owner/provisioning path (cross-tenant writes with no app.tenant GUC) — verified.
--
-- Switch from FORCE to ENABLE-only: the table OWNER (owner DATABASE_URL: migrations,
-- seed, provisioning, platform routes — all legitimately cross-tenant) bypasses RLS
-- by ownership, while the non-owner app role il_app (which SERVES requests) remains
-- fully subject to the policies. Isolation for the request path is unchanged; the
-- boot guard still prevents serving requests as the owner.
-- Forward-only; safe to re-run (NO FORCE is idempotent).

ALTER TABLE "AuditCascade" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditEntry" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "CrossTrigger" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "DashboardLayout" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "DataSharing" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "Entity" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "EntityType" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "FieldDef" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "FieldRule" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "FleetOperator" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "Integration" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "OrgNode" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "PortalMessage" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "RbacVersion" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "Report" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "Role" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "Session" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "StageConfig" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "StageDef" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "TimelineEvent" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "TrackDef" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "User" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserPreference" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserScope" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "VehicleTimeline" NO FORCE ROW LEVEL SECURITY;
