-- Task 6: Enable Row-Level Security on all 26 tenant-scoped tables.
-- USING filters reads/updates/deletes; WITH CHECK blocks inserts/updates into another tenant.
-- FORCE makes the policy apply even to the table owner (defense-in-depth).
-- current_setting('app.tenant', true) returns NULL (not error) when unset,
-- so the postgres superuser (which never sets the GUC) still bypasses via SUPERUSER privilege.

-- OrgNode
ALTER TABLE "OrgNode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgNode" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orgnode_tenant_isolation ON "OrgNode";
CREATE POLICY orgnode_tenant_isolation ON "OrgNode"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- User
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_tenant_isolation ON "User";
CREATE POLICY user_tenant_isolation ON "User"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- UserScope
ALTER TABLE "UserScope" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserScope" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS userscope_tenant_isolation ON "UserScope";
CREATE POLICY userscope_tenant_isolation ON "UserScope"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- Session
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_tenant_isolation ON "Session";
CREATE POLICY session_tenant_isolation ON "Session"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- Role
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_tenant_isolation ON "Role";
CREATE POLICY role_tenant_isolation ON "Role"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- FieldRule
ALTER TABLE "FieldRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FieldRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fieldrule_tenant_isolation ON "FieldRule";
CREATE POLICY fieldrule_tenant_isolation ON "FieldRule"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- RbacVersion
ALTER TABLE "RbacVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RbacVersion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rbacversion_tenant_isolation ON "RbacVersion";
CREATE POLICY rbacversion_tenant_isolation ON "RbacVersion"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- StageConfig
ALTER TABLE "StageConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StageConfig" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stageconfig_tenant_isolation ON "StageConfig";
CREATE POLICY stageconfig_tenant_isolation ON "StageConfig"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- CrossTrigger
ALTER TABLE "CrossTrigger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrossTrigger" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crosstrigger_tenant_isolation ON "CrossTrigger";
CREATE POLICY crosstrigger_tenant_isolation ON "CrossTrigger"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- FleetOperator
ALTER TABLE "FleetOperator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetOperator" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fleetoperator_tenant_isolation ON "FleetOperator";
CREATE POLICY fleetoperator_tenant_isolation ON "FleetOperator"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- Invoice
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_tenant_isolation ON "Invoice";
CREATE POLICY invoice_tenant_isolation ON "Invoice"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- VehicleTimeline
ALTER TABLE "VehicleTimeline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VehicleTimeline" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vehicletimeline_tenant_isolation ON "VehicleTimeline";
CREATE POLICY vehicletimeline_tenant_isolation ON "VehicleTimeline"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- TimelineEvent
ALTER TABLE "TimelineEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimelineEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timelineevent_tenant_isolation ON "TimelineEvent";
CREATE POLICY timelineevent_tenant_isolation ON "TimelineEvent"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- Integration
ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Integration" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integration_tenant_isolation ON "Integration";
CREATE POLICY integration_tenant_isolation ON "Integration"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- AuditEntry
ALTER TABLE "AuditEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auditentry_tenant_isolation ON "AuditEntry";
CREATE POLICY auditentry_tenant_isolation ON "AuditEntry"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- AuditCascade
ALTER TABLE "AuditCascade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditCascade" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auditcascade_tenant_isolation ON "AuditCascade";
CREATE POLICY auditcascade_tenant_isolation ON "AuditCascade"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- Report
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_tenant_isolation ON "Report";
CREATE POLICY report_tenant_isolation ON "Report"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- DashboardLayout
ALTER TABLE "DashboardLayout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DashboardLayout" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dashboardlayout_tenant_isolation ON "DashboardLayout";
CREATE POLICY dashboardlayout_tenant_isolation ON "DashboardLayout"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- DataSharing
ALTER TABLE "DataSharing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataSharing" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS datasharing_tenant_isolation ON "DataSharing";
CREATE POLICY datasharing_tenant_isolation ON "DataSharing"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- UserPreference
ALTER TABLE "UserPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPreference" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS userpreference_tenant_isolation ON "UserPreference";
CREATE POLICY userpreference_tenant_isolation ON "UserPreference"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- PortalMessage
ALTER TABLE "PortalMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalMessage" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portalmessage_tenant_isolation ON "PortalMessage";
CREATE POLICY portalmessage_tenant_isolation ON "PortalMessage"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- TrackDef
ALTER TABLE "TrackDef" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackDef" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trackdef_tenant_isolation ON "TrackDef";
CREATE POLICY trackdef_tenant_isolation ON "TrackDef"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- StageDef
ALTER TABLE "StageDef" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StageDef" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stagedef_tenant_isolation ON "StageDef";
CREATE POLICY stagedef_tenant_isolation ON "StageDef"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- EntityType
ALTER TABLE "EntityType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntityType" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entitytype_tenant_isolation ON "EntityType";
CREATE POLICY entitytype_tenant_isolation ON "EntityType"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- FieldDef
ALTER TABLE "FieldDef" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FieldDef" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fielddef_tenant_isolation ON "FieldDef";
CREATE POLICY fielddef_tenant_isolation ON "FieldDef"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- Entity
ALTER TABLE "Entity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Entity" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_tenant_isolation ON "Entity";
CREATE POLICY entity_tenant_isolation ON "Entity"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));
