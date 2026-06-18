-- Task 1 (S1 Provisioning Engine): Add Blueprint + ProvisioningRun tables and User.platformAdmin.
-- Platform-level tables: NO tenantId, NO RLS (they live above tenants).
-- Purely additive migration.

-- Enums
CREATE TYPE "BlueprintStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- Blueprint table (platform-level, no RLS)
CREATE TABLE "Blueprint" (
    "id"             TEXT NOT NULL,
    "key"            TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "version"        INTEGER NOT NULL DEFAULT 1,
    "status"         "BlueprintStatus" NOT NULL DEFAULT 'DRAFT',
    "spec"           JSONB NOT NULL,
    "sourceTenantId" TEXT,
    "description"    TEXT,
    "createdById"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blueprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Blueprint_key_key" ON "Blueprint"("key");

-- ProvisioningRun table (platform-level, no RLS)
CREATE TABLE "ProvisioningRun" (
    "id"             TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "blueprintId"    TEXT NOT NULL,
    "tenantId"       TEXT,
    "slug"           TEXT NOT NULL,
    "status"         "ProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "steps"          JSONB,
    "error"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"     TIMESTAMP(3),

    CONSTRAINT "ProvisioningRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProvisioningRun_idempotencyKey_key" ON "ProvisioningRun"("idempotencyKey");
CREATE INDEX "ProvisioningRun_blueprintId_idx" ON "ProvisioningRun"("blueprintId");

-- Foreign key: ProvisioningRun → Blueprint
ALTER TABLE "ProvisioningRun" ADD CONSTRAINT "ProvisioningRun_blueprintId_fkey"
    FOREIGN KEY ("blueprintId") REFERENCES "Blueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add platformAdmin column to User (additive, defaults false)
ALTER TABLE "User" ADD COLUMN "platformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Grant il_app access (explicit for S0 consistency; default privileges also cover this)
GRANT SELECT, INSERT, UPDATE, DELETE ON "Blueprint", "ProvisioningRun" TO il_app;
