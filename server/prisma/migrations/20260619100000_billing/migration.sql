-- Task 1 (S6 Billing): Add Plan (platform-level, no RLS) + Subscription (tenant-scoped, RLS).
-- Plan is a global pricing catalogue — no tenantId, no RLS.
-- Subscription links a tenant to a plan — tenant-scoped with full RLS.

-- Enum: SubscriptionStatus
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- Plan table (platform-level, no RLS)
CREATE TABLE "Plan" (
    "id"           TEXT NOT NULL,
    "key"          TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "tier"         INTEGER NOT NULL DEFAULT 0,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "currency"     TEXT NOT NULL DEFAULT 'eur',
    "entitlements" JSONB NOT NULL,
    "active"       BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

-- Subscription table (tenant-scoped, RLS below)
CREATE TABLE "Subscription" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "planId"           TEXT NOT NULL,
    "status"           "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "provider"         TEXT NOT NULL DEFAULT 'simulated',
    "providerRef"      TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "seats"            INTEGER,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- Foreign keys
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS on Subscription (NOT on Plan — Plan is platform-level)
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_tenant_isolation ON "Subscription";
CREATE POLICY subscription_tenant_isolation ON "Subscription"
  USING      ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

-- Grant il_app access to both tables
GRANT SELECT, INSERT, UPDATE, DELETE ON "Plan", "Subscription" TO il_app;
