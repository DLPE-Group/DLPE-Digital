import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../prisma.js';

export interface SubscriptionState {
  tenantId: string;
  planKey: string;
  status: string;
  provider: string;
  currentPeriodEnd: Date | null;
}

export interface BillingProvider {
  createSubscription(a: { tenantId: string; planKey: string; seats?: number; status?: string }): Promise<SubscriptionState>;
  changePlan(a: { tenantId: string; planKey: string }): Promise<SubscriptionState>;
  cancel(a: { tenantId: string }): Promise<SubscriptionState>;
}

function currentPeriodEnd(): Date {
  return new Date(Date.now() + 30 * 864e5);
}

export class SimulatedBillingProvider implements BillingProvider {
  private readonly db: PrismaClient;

  constructor(db?: PrismaClient) {
    this.db = db ?? defaultPrisma;
  }

  private async resolvePlanId(planKey: string): Promise<string> {
    const plan = await this.db.plan.findUnique({ where: { key: planKey } });
    if (!plan) throw new Error(`Plan not found for key: ${planKey}`);
    return plan.id;
  }

  private async toState(tenantId: string): Promise<SubscriptionState> {
    const sub = await this.db.subscription.findUniqueOrThrow({
      where: { tenantId },
      include: { plan: true },
    });
    return {
      tenantId: sub.tenantId,
      planKey: sub.plan.key,
      status: sub.status,
      provider: sub.provider,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  async createSubscription(a: { tenantId: string; planKey: string; seats?: number; status?: string }): Promise<SubscriptionState> {
    const planId = await this.resolvePlanId(a.planKey);
    const status = (a.status ?? 'ACTIVE') as 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED';
    await this.db.subscription.upsert({
      where: { tenantId: a.tenantId },
      create: {
        tenantId: a.tenantId,
        planId,
        status,
        provider: 'simulated',
        currentPeriodEnd: currentPeriodEnd(),
        ...(a.seats !== undefined ? { seats: a.seats } : {}),
      },
      update: {
        planId,
        status,
        currentPeriodEnd: currentPeriodEnd(),
        ...(a.seats !== undefined ? { seats: a.seats } : {}),
      },
    });
    return this.toState(a.tenantId);
  }

  async changePlan(a: { tenantId: string; planKey: string }): Promise<SubscriptionState> {
    const planId = await this.resolvePlanId(a.planKey);
    await this.db.subscription.update({
      where: { tenantId: a.tenantId },
      data: { planId },
    });
    return this.toState(a.tenantId);
  }

  async cancel(a: { tenantId: string }): Promise<SubscriptionState> {
    await this.db.subscription.update({
      where: { tenantId: a.tenantId },
      data: { status: 'CANCELED' },
    });
    return this.toState(a.tenantId);
  }
}

export class StripeBillingProvider implements BillingProvider {
  async createSubscription(_a: { tenantId: string; planKey: string; seats?: number; status?: string }): Promise<SubscriptionState> {
    throw new Error('Stripe billing is deferred to a future spec');
  }

  async changePlan(_a: { tenantId: string; planKey: string }): Promise<SubscriptionState> {
    throw new Error('Stripe billing is deferred to a future spec');
  }

  async cancel(_a: { tenantId: string }): Promise<SubscriptionState> {
    throw new Error('Stripe billing is deferred to a future spec');
  }
}

export const billingProvider: BillingProvider = new SimulatedBillingProvider();
