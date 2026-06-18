-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TenancyMode" AS ENUM ('SHARED', 'DEDICATED');

-- AlterTable
ALTER TABLE "AuditCascade" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AuditEntry" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CrossTrigger" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "DashboardLayout" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "DataSharing" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "EntityType" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "FieldDef" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "FieldRule" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "FleetOperator" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "OrgNode" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PortalMessage" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "RbacVersion" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "StageConfig" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "StageDef" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "TimelineEvent" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "TrackDef" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "UserScope" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "VehicleTimeline" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "tenancyMode" "TenancyMode" NOT NULL DEFAULT 'SHARED',
    "region" TEXT NOT NULL DEFAULT 'eu',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "AuditCascade_tenantId_idx" ON "AuditCascade"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEntry_tenantId_idx" ON "AuditEntry"("tenantId");

-- CreateIndex
CREATE INDEX "CrossTrigger_tenantId_idx" ON "CrossTrigger"("tenantId");

-- CreateIndex
CREATE INDEX "DashboardLayout_tenantId_idx" ON "DashboardLayout"("tenantId");

-- CreateIndex
CREATE INDEX "DataSharing_tenantId_idx" ON "DataSharing"("tenantId");

-- CreateIndex
CREATE INDEX "EntityType_tenantId_idx" ON "EntityType"("tenantId");

-- CreateIndex
CREATE INDEX "FieldDef_tenantId_idx" ON "FieldDef"("tenantId");

-- CreateIndex
CREATE INDEX "FieldRule_tenantId_idx" ON "FieldRule"("tenantId");

-- CreateIndex
CREATE INDEX "FleetOperator_tenantId_idx" ON "FleetOperator"("tenantId");

-- CreateIndex
CREATE INDEX "Integration_tenantId_idx" ON "Integration"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "OrgNode_tenantId_idx" ON "OrgNode"("tenantId");

-- CreateIndex
CREATE INDEX "PortalMessage_tenantId_idx" ON "PortalMessage"("tenantId");

-- CreateIndex
CREATE INDEX "RbacVersion_tenantId_idx" ON "RbacVersion"("tenantId");

-- CreateIndex
CREATE INDEX "Report_tenantId_idx" ON "Report"("tenantId");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE INDEX "Session_tenantId_idx" ON "Session"("tenantId");

-- CreateIndex
CREATE INDEX "StageConfig_tenantId_idx" ON "StageConfig"("tenantId");

-- CreateIndex
CREATE INDEX "StageDef_tenantId_idx" ON "StageDef"("tenantId");

-- CreateIndex
CREATE INDEX "TimelineEvent_tenantId_idx" ON "TimelineEvent"("tenantId");

-- CreateIndex
CREATE INDEX "TrackDef_tenantId_idx" ON "TrackDef"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "UserPreference_tenantId_idx" ON "UserPreference"("tenantId");

-- CreateIndex
CREATE INDEX "UserScope_tenantId_idx" ON "UserScope"("tenantId");

-- CreateIndex
CREATE INDEX "VehicleTimeline_tenantId_idx" ON "VehicleTimeline"("tenantId");

-- AddForeignKey (NOT VALID: skip validation of existing rows; Task 2 backfill will make all rows valid)
ALTER TABLE "OrgNode" ADD CONSTRAINT "OrgNode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "UserScope" ADD CONSTRAINT "UserScope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "FieldRule" ADD CONSTRAINT "FieldRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "RbacVersion" ADD CONSTRAINT "RbacVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "StageConfig" ADD CONSTRAINT "StageConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "CrossTrigger" ADD CONSTRAINT "CrossTrigger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "FleetOperator" ADD CONSTRAINT "FleetOperator_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "VehicleTimeline" ADD CONSTRAINT "VehicleTimeline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "AuditCascade" ADD CONSTRAINT "AuditCascade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "DashboardLayout" ADD CONSTRAINT "DashboardLayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "DataSharing" ADD CONSTRAINT "DataSharing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "TrackDef" ADD CONSTRAINT "TrackDef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "StageDef" ADD CONSTRAINT "StageDef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "EntityType" ADD CONSTRAINT "EntityType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "FieldDef" ADD CONSTRAINT "FieldDef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
