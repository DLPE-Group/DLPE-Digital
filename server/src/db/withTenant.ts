import { PrismaClient, Prisma } from '@prisma/client';
import { appDatabaseUrl } from '../env.js';

// Dedicated client that connects as the RLS-enforced il_app role.
export const appPrisma = new PrismaClient({
  datasources: { db: { url: appDatabaseUrl } },
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});

// Run `fn` inside a transaction scoped to one tenant. SET LOCAL keeps the GUC
// bound to this transaction only, so pooled connections never leak context.
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return appPrisma.$transaction(async (tx) => {
    // set_config(name, value, is_local=true) — parameterized, injection-safe.
    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
    return fn(tx);
  });
}
