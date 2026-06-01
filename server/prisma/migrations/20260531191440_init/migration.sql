-- CreateEnum
CREATE TYPE "Track" AS ENUM ('SALES', 'OPERATIONS', 'WORKSHOP', 'FINANCE');

-- CreateEnum
CREATE TYPE "OrgKind" AS ENUM ('GROUP', 'REGION', 'COUNTRY', 'COMPANY');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('group', 'region', 'country', 'multi_company', 'company', 'self');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'invited', 'disabled');

-- CreateEnum
CREATE TYPE "SharingMode" AS ENUM ('shared', 'private', 'group');

-- CreateEnum
CREATE TYPE "RuleScope" AS ENUM ('ANY', 'NL', 'BE', 'DE', 'ROTTERDAM');

-- CreateTable
CREATE TABLE "OrgNode" (
    "id" TEXT NOT NULL,
    "kind" "OrgKind" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "meta" JSONB,
    "settings" JSONB,
    "overrides" JSONB,
    "parentId" TEXT,

    CONSTRAINT "OrgNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountryDefaults" (
    "code" TEXT NOT NULL,
    "vat" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "peppol" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,

    CONSTRAINT "CountryDefaults_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT true,
    "tracks" TEXT[],
    "users" INTEGER NOT NULL DEFAULT 0,
    "edit" TEXT NOT NULL,
    "desc" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "initials" TEXT,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeNodeId" TEXT,
    "scopeLabel" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "lastSeen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT,
    "scopeType" "ScopeType" NOT NULL DEFAULT 'company',
    "scopeNodeId" TEXT,
    "scopeLabel" TEXT,
    "roleLabel" TEXT,

    CONSTRAINT "UserScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "track" "Track" NOT NULL,
    "type" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "value" INTEGER,
    "vehicle" TEXT,
    "sub" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "daysLabel" TEXT,
    "owner" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "sources" TEXT[],
    "awaitingSign" BOOLEAN NOT NULL DEFAULT false,
    "meta" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldRule" (
    "roleId" TEXT NOT NULL,
    "dataTypeId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "scope" "RuleScope" NOT NULL DEFAULT 'ANY',
    "visible" BOOLEAN NOT NULL,
    "editable" BOOLEAN NOT NULL,
    "masked" BOOLEAN NOT NULL,
    "note" TEXT,

    CONSTRAINT "FieldRule_pkey" PRIMARY KEY ("roleId","dataTypeId","fieldId","scope")
);

-- CreateTable
CREATE TABLE "RbacVersion" (
    "v" INTEGER NOT NULL,
    "when" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "RbacVersion_pkey" PRIMARY KEY ("v")
);

-- CreateTable
CREATE TABLE "StageConfig" (
    "id" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "order" INTEGER NOT NULL,
    "stageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sla" INTEGER NOT NULL,
    "lock" TEXT,
    "cta" TEXT NOT NULL,

    CONSTRAINT "StageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossTrigger" (
    "id" TEXT NOT NULL,
    "whenTrack" TEXT NOT NULL,
    "whenStage" TEXT NOT NULL,
    "thenTrack" TEXT NOT NULL,
    "thenStage" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "CrossTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "model" TEXT,
    "vin" TEXT,
    "operator" TEXT,
    "status" TEXT,
    "statusLabel" TEXT,
    "note" TEXT,
    "companyId" TEXT,
    "meta" JSONB,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetOperator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "companyId" TEXT,
    "meta" JSONB,

    CONSTRAINT "FleetOperator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "value" INTEGER,
    "due" TEXT,
    "status" TEXT,
    "companyId" TEXT,
    "meta" JSONB,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleTimeline" (
    "id" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "contractValue" INTEGER,
    "account" TEXT,

    CONSTRAINT "VehicleTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "track" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "detail" TEXT,
    "date" TEXT,
    "owner" TEXT,
    "state" TEXT,
    "docs" TEXT[],

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSync" TEXT,
    "throughput" TEXT,
    "latency" TEXT,
    "desc" TEXT,
    "nango" BOOLEAN NOT NULL DEFAULT false,
    "transforms" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "day" TEXT,
    "time" TEXT,
    "actor" TEXT NOT NULL,
    "actorRole" TEXT,
    "verb" TEXT NOT NULL,
    "target" TEXT,
    "track" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'normal',
    "icon" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditCascade" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "track" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "AuditCascade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "prose" JSONB NOT NULL,
    "when" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardLayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "charts" JSONB NOT NULL,

    CONSTRAINT "DashboardLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSharing" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" "SharingMode" NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "DataSharing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgNode_parentId_idx" ON "OrgNode"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserScope_userId_idx" ON "UserScope"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Card_companyId_track_stageId_idx" ON "Card"("companyId", "track", "stageId");

-- CreateIndex
CREATE INDEX "StageConfig_track_order_idx" ON "StageConfig"("track", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StageConfig_track_stageId_key" ON "StageConfig"("track", "stageId");

-- CreateIndex
CREATE INDEX "CrossTrigger_whenTrack_whenStage_idx" ON "CrossTrigger"("whenTrack", "whenStage");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_ref_key" ON "Invoice"("ref");

-- CreateIndex
CREATE INDEX "TimelineEvent_timelineId_order_idx" ON "TimelineEvent"("timelineId", "order");

-- CreateIndex
CREATE INDEX "AuditEntry_track_idx" ON "AuditEntry"("track");

-- CreateIndex
CREATE INDEX "AuditCascade_auditId_order_idx" ON "AuditCascade"("auditId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardLayout_userId_key" ON "DashboardLayout"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DataSharing_type_key" ON "DataSharing"("type");

-- AddForeignKey
ALTER TABLE "OrgNode" ADD CONSTRAINT "OrgNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_scopeNodeId_fkey" FOREIGN KEY ("scopeNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScope" ADD CONSTRAINT "UserScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScope" ADD CONSTRAINT "UserScope_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScope" ADD CONSTRAINT "UserScope_scopeNodeId_fkey" FOREIGN KEY ("scopeNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldRule" ADD CONSTRAINT "FieldRule_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetOperator" ADD CONSTRAINT "FleetOperator_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "VehicleTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCascade" ADD CONSTRAINT "AuditCascade_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AuditEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardLayout" ADD CONSTRAINT "DashboardLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
