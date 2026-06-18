-- Task 2: Backfill demo tenant + flip tenantId to NOT NULL (contract).
-- NOT safe to re-run by hand; `prisma migrate deploy` applies each migration exactly once.

-- 1) Ensure the demo tenant exists (idempotent).
INSERT INTO "Tenant" ("id","slug","name","status","tenancyMode","region","createdAt")
VALUES ('tenant-dlpe-demo','dlpe-demo','DLPE Demo','ACTIVE','SHARED','eu', now())
ON CONFLICT ("slug") DO NOTHING;

-- 2) Backfill every scoped table to the demo tenant (single-tenant today).
--    Also fix any stale tenantId values that reference OrgNode ids from a prior
--    design iteration (those are not valid Tenant ids either).
UPDATE "OrgNode"          SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "User"             SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "UserScope"        SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "Session"          SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "Role"             SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "FieldRule"        SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "RbacVersion"      SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "StageConfig"      SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "CrossTrigger"     SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "FleetOperator"    SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "Invoice"          SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "VehicleTimeline"  SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "TimelineEvent"    SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "Integration"      SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "AuditEntry"       SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "AuditCascade"     SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "Report"           SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "DashboardLayout"  SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "DataSharing"      SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "UserPreference"   SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "PortalMessage"    SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "TrackDef"         SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "StageDef"         SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "EntityType"       SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "FieldDef"         SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");
UPDATE "Entity"           SET "tenantId"='tenant-dlpe-demo' WHERE "tenantId" IS NULL OR "tenantId" NOT IN (SELECT "id" FROM "Tenant");

-- 3) Validate the NOT VALID FK constraints added by Task 1 migration.
--    Now that all rows have a valid tenantId, full validation is safe.
ALTER TABLE "OrgNode"         VALIDATE CONSTRAINT "OrgNode_tenantId_fkey";
ALTER TABLE "Role"            VALIDATE CONSTRAINT "Role_tenantId_fkey";
ALTER TABLE "User"            VALIDATE CONSTRAINT "User_tenantId_fkey";
ALTER TABLE "UserScope"       VALIDATE CONSTRAINT "UserScope_tenantId_fkey";
ALTER TABLE "Session"         VALIDATE CONSTRAINT "Session_tenantId_fkey";
ALTER TABLE "FieldRule"       VALIDATE CONSTRAINT "FieldRule_tenantId_fkey";
ALTER TABLE "RbacVersion"     VALIDATE CONSTRAINT "RbacVersion_tenantId_fkey";
ALTER TABLE "StageConfig"     VALIDATE CONSTRAINT "StageConfig_tenantId_fkey";
ALTER TABLE "CrossTrigger"    VALIDATE CONSTRAINT "CrossTrigger_tenantId_fkey";
ALTER TABLE "FleetOperator"   VALIDATE CONSTRAINT "FleetOperator_tenantId_fkey";
ALTER TABLE "Invoice"         VALIDATE CONSTRAINT "Invoice_tenantId_fkey";
ALTER TABLE "VehicleTimeline" VALIDATE CONSTRAINT "VehicleTimeline_tenantId_fkey";
ALTER TABLE "TimelineEvent"   VALIDATE CONSTRAINT "TimelineEvent_tenantId_fkey";
ALTER TABLE "Integration"     VALIDATE CONSTRAINT "Integration_tenantId_fkey";
ALTER TABLE "AuditEntry"      VALIDATE CONSTRAINT "AuditEntry_tenantId_fkey";
ALTER TABLE "AuditCascade"    VALIDATE CONSTRAINT "AuditCascade_tenantId_fkey";
ALTER TABLE "Report"          VALIDATE CONSTRAINT "Report_tenantId_fkey";
ALTER TABLE "DashboardLayout" VALIDATE CONSTRAINT "DashboardLayout_tenantId_fkey";
ALTER TABLE "DataSharing"     VALIDATE CONSTRAINT "DataSharing_tenantId_fkey";
ALTER TABLE "UserPreference"  VALIDATE CONSTRAINT "UserPreference_tenantId_fkey";
ALTER TABLE "PortalMessage"   VALIDATE CONSTRAINT "PortalMessage_tenantId_fkey";
ALTER TABLE "TrackDef"        VALIDATE CONSTRAINT "TrackDef_tenantId_fkey";
ALTER TABLE "StageDef"        VALIDATE CONSTRAINT "StageDef_tenantId_fkey";
ALTER TABLE "EntityType"      VALIDATE CONSTRAINT "EntityType_tenantId_fkey";
ALTER TABLE "FieldDef"        VALIDATE CONSTRAINT "FieldDef_tenantId_fkey";
ALTER TABLE "Entity"          VALIDATE CONSTRAINT "Entity_tenantId_fkey";

-- 4) Re-create FK constraints with onDelete: RESTRICT (was SET NULL — incompatible with NOT NULL).
--    Do this BEFORE setting NOT NULL so the constraint definition is correct.
ALTER TABLE "OrgNode"         DROP CONSTRAINT "OrgNode_tenantId_fkey";
ALTER TABLE "Role"            DROP CONSTRAINT "Role_tenantId_fkey";
ALTER TABLE "User"            DROP CONSTRAINT "User_tenantId_fkey";
ALTER TABLE "UserScope"       DROP CONSTRAINT "UserScope_tenantId_fkey";
ALTER TABLE "Session"         DROP CONSTRAINT "Session_tenantId_fkey";
ALTER TABLE "FieldRule"       DROP CONSTRAINT "FieldRule_tenantId_fkey";
ALTER TABLE "RbacVersion"     DROP CONSTRAINT "RbacVersion_tenantId_fkey";
ALTER TABLE "StageConfig"     DROP CONSTRAINT "StageConfig_tenantId_fkey";
ALTER TABLE "CrossTrigger"    DROP CONSTRAINT "CrossTrigger_tenantId_fkey";
ALTER TABLE "FleetOperator"   DROP CONSTRAINT "FleetOperator_tenantId_fkey";
ALTER TABLE "Invoice"         DROP CONSTRAINT "Invoice_tenantId_fkey";
ALTER TABLE "VehicleTimeline" DROP CONSTRAINT "VehicleTimeline_tenantId_fkey";
ALTER TABLE "TimelineEvent"   DROP CONSTRAINT "TimelineEvent_tenantId_fkey";
ALTER TABLE "Integration"     DROP CONSTRAINT "Integration_tenantId_fkey";
ALTER TABLE "AuditEntry"      DROP CONSTRAINT "AuditEntry_tenantId_fkey";
ALTER TABLE "AuditCascade"    DROP CONSTRAINT "AuditCascade_tenantId_fkey";
ALTER TABLE "Report"          DROP CONSTRAINT "Report_tenantId_fkey";
ALTER TABLE "DashboardLayout" DROP CONSTRAINT "DashboardLayout_tenantId_fkey";
ALTER TABLE "DataSharing"     DROP CONSTRAINT "DataSharing_tenantId_fkey";
ALTER TABLE "UserPreference"  DROP CONSTRAINT "UserPreference_tenantId_fkey";
ALTER TABLE "PortalMessage"   DROP CONSTRAINT "PortalMessage_tenantId_fkey";
ALTER TABLE "TrackDef"        DROP CONSTRAINT "TrackDef_tenantId_fkey";
ALTER TABLE "StageDef"        DROP CONSTRAINT "StageDef_tenantId_fkey";
ALTER TABLE "EntityType"      DROP CONSTRAINT "EntityType_tenantId_fkey";
ALTER TABLE "FieldDef"        DROP CONSTRAINT "FieldDef_tenantId_fkey";
ALTER TABLE "Entity"          DROP CONSTRAINT "Entity_tenantId_fkey";

ALTER TABLE "OrgNode"         ADD CONSTRAINT "OrgNode_tenantId_fkey"         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Role"            ADD CONSTRAINT "Role_tenantId_fkey"            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User"            ADD CONSTRAINT "User_tenantId_fkey"            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserScope"       ADD CONSTRAINT "UserScope_tenantId_fkey"       FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session"         ADD CONSTRAINT "Session_tenantId_fkey"         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldRule"       ADD CONSTRAINT "FieldRule_tenantId_fkey"       FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RbacVersion"     ADD CONSTRAINT "RbacVersion_tenantId_fkey"     FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StageConfig"     ADD CONSTRAINT "StageConfig_tenantId_fkey"     FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrossTrigger"    ADD CONSTRAINT "CrossTrigger_tenantId_fkey"    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FleetOperator"   ADD CONSTRAINT "FleetOperator_tenantId_fkey"   FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice"         ADD CONSTRAINT "Invoice_tenantId_fkey"         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTimeline" ADD CONSTRAINT "VehicleTimeline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent"   ADD CONSTRAINT "TimelineEvent_tenantId_fkey"   FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Integration"     ADD CONSTRAINT "Integration_tenantId_fkey"     FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEntry"      ADD CONSTRAINT "AuditEntry_tenantId_fkey"      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditCascade"    ADD CONSTRAINT "AuditCascade_tenantId_fkey"    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report"          ADD CONSTRAINT "Report_tenantId_fkey"          FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DashboardLayout" ADD CONSTRAINT "DashboardLayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataSharing"     ADD CONSTRAINT "DataSharing_tenantId_fkey"     FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserPreference"  ADD CONSTRAINT "UserPreference_tenantId_fkey"  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortalMessage"   ADD CONSTRAINT "PortalMessage_tenantId_fkey"   FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackDef"        ADD CONSTRAINT "TrackDef_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StageDef"        ADD CONSTRAINT "StageDef_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntityType"      ADD CONSTRAINT "EntityType_tenantId_fkey"      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldDef"        ADD CONSTRAINT "FieldDef_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entity"          ADD CONSTRAINT "Entity_tenantId_fkey"          FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Now enforce NOT NULL on every scoped table.
ALTER TABLE "OrgNode"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "User"             ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "UserScope"        ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Session"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Role"             ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "FieldRule"        ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "RbacVersion"      ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StageConfig"      ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CrossTrigger"     ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "FleetOperator"    ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Invoice"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "VehicleTimeline"  ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "TimelineEvent"    ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Integration"      ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "AuditEntry"       ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "AuditCascade"     ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Report"           ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "DashboardLayout"  ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "DataSharing"      ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "UserPreference"   ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PortalMessage"    ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "TrackDef"         ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StageDef"         ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "EntityType"       ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "FieldDef"         ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Entity"           ALTER COLUMN "tenantId" SET NOT NULL;
