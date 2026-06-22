import { Router } from 'express';
import { SAMPLE_RECORDS, DATA_TYPES } from '@dlpe/shared';
import { buildEffectiveForUser, buildEffectiveForRole } from '../rbac/context.js';
import { filterRecord } from '../rbac/filterRecord.js';
import { withTenant } from '../db/withTenant.js';

export const recordsRouter: Router = Router();

const ADMIN_ROLE_IDS = new Set(['group-admin', 'sys-integrator', 'country-mgr']);

// GET /records/:dataType
//   ?previewAs=<userId>  (admin only) -> filter using the target user's rules
//   ?role=<roleId>       (admin only) -> filter using a single role's rules
// Default: filter using the current user's effective rules.
// NOTE: the record data itself is static (SAMPLE_RECORDS from @dlpe/shared);
// withTenant is used here solely to enforce RLS on the RBAC helper DB reads
// (FieldRule / Role / User lookups inside buildEffectiveForUser/buildEffectiveForRole).
recordsRouter.get('/:dataType', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const dataType = req.params.dataType;
  const record = SAMPLE_RECORDS[dataType];
  if (!record || !DATA_TYPES.some((d) => d.id === dataType)) {
    return res.status(404).json({ error: `Unknown data type ${dataType}` });
  }

  const isAdmin = ADMIN_ROLE_IDS.has(user.roleId);
  const previewAs = typeof req.query.previewAs === 'string' ? req.query.previewAs : undefined;
  const role = typeof req.query.role === 'string' ? req.query.role : undefined;

  try {
    const { effective, previewAsOut } = await withTenant(req.tenantId!, async (db) => {
      let effective;
      let previewAsOut: string | undefined;

      if (role && isAdmin) {
        ({ effective } = await buildEffectiveForRole(role, db));
        previewAsOut = `role:${role}`;
      } else if (previewAs && isAdmin) {
        ({ effective } = await buildEffectiveForUser(previewAs, db));
        previewAsOut = previewAs;
      } else {
        ({ effective } = await buildEffectiveForUser(user.id, db));
      }

      return { effective, previewAsOut };
    });

    const filtered = filterRecord(record as Record<string, unknown>, dataType, effective);
    res.json({ dataType, record: filtered, previewAs: previewAsOut });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
