/* ============================================================
   Platform plan catalogue — the subscription tiers the provisioning
   wizard offers and that tenants are billed on.

   Platform-level reference data (no tenantId). Created by both the full
   demo seed and the prod bootstrap (bootstrap-blueprints) so a fresh
   production DB has plans to choose from — otherwise the wizard's plan
   dropdown shows only "blueprint default" and provisioned tenants get
   no subscription attached.
   ============================================================ */

export interface PlanSeed {
  key: string;
  name: string;
  tier: number;
  priceMonthly: number;
  entitlements: { features: string[]; limits: Record<string, number> };
}

export const PLATFORM_PLANS: PlanSeed[] = [
  { key: 'starter',    name: 'Starter',    tier: 1, priceMonthly: 4900,  entitlements: { features: ['reports'], limits: { maxUsers: 10 } } },
  { key: 'pro',        name: 'Pro',        tier: 2, priceMonthly: 14900, entitlements: { features: ['reports', 'api_access'], limits: { maxUsers: 50 } } },
  { key: 'enterprise', name: 'Enterprise', tier: 3, priceMonthly: 0,     entitlements: { features: ['reports', 'api_access', 'sso', 'custom_domain'], limits: {} } },
];
