import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

type Db = Prisma.TransactionClient | typeof prisma;

// Recover the *operational* track/type key from a (possibly prefixed) registry
// key. TrackDef.key / EntityType.key are GLOBALLY unique, so the provisioner
// namespaces builtin rows as `<slug>-<key>`. The rest of the runtime (Entity
// .trackId, StageConfig, /cards, allowedTracks, the UI) keys on the bare
// operational key, so strip the tenant `<slug>-` prefix from builtin rows.
// Authored (builtin=false) rows are already bare and pass through unchanged.
export function operationalKey(key: string, builtin: boolean, slugPrefix: string): string {
  return builtin && slugPrefix && key.startsWith(slugPrefix) ? key.slice(slugPrefix.length) : key;
}

// The `<slug>-` prefix for a tenant. NB: the Tenant registry is NOT RLS-filtered,
// so always fetch by id — never findMany()[0].
export async function tenantSlugPrefix(tenantId: string, db: Db): Promise<string> {
  const t = await db.tenant.findUnique({ where: { id: tenantId } });
  return t?.slug ? `${t.slug}-` : '';
}

// The tenant's operational track keys, ordered — the single source of truth for
// "which tracks does this tenant have" across the API and UI.
export async function tenantTrackKeys(tenantId: string, db: Db): Promise<string[]> {
  const pfx = await tenantSlugPrefix(tenantId, db);
  const rows = await db.trackDef.findMany({ orderBy: { order: 'asc' } });
  return rows.map((t) => operationalKey(t.key, t.builtin, pfx));
}
