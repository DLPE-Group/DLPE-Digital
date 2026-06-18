import { Prisma } from '@prisma/client';

export interface TenantContext { tenantId: string; slug: string; }

export interface ProvisioningTarget {
  prepare(
    args: { slug: string; name: string; region: string; tenantId?: string },
    tx: Prisma.TransactionClient,
  ): Promise<TenantContext>;
}

export class SharedDbTarget implements ProvisioningTarget {
  async prepare(args: { slug: string; name: string; region: string; tenantId?: string }, tx: Prisma.TransactionClient): Promise<TenantContext> {
    const tenant = await tx.tenant.create({
      data: { ...(args.tenantId ? { id: args.tenantId } : {}), slug: args.slug, name: args.name, region: args.region, status: 'ACTIVE', tenancyMode: 'SHARED' },
    });
    return { tenantId: tenant.id, slug: tenant.slug };
  }
}

export class DedicatedDeploymentTarget implements ProvisioningTarget {
  async prepare(): Promise<TenantContext> {
    throw new Error('Dedicated deployment is deferred to a future spec');
  }
}
