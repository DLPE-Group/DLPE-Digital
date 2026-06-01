import { describe, it, expect } from 'vitest';
import { get, token, ADMIN } from '../helpers.mjs';

// Admin-only areas: /api/admin/*, /api/integrations, /api/audit are restricted
// to group-admin (server-enforced via requireAdmin), independent of the hidden
// frontend nav.
const NON_ADMIN = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');
const SYS_INT = () => token('u-anna', 'a.kowalska@group.eu', 'sys-integrator');

const ADMIN_PATHS = ['/admin/users', '/admin/structure', '/admin/roles', '/integrations', '/audit'];

describe('admin-only area enforcement', () => {
  it('group-admin can reach every admin area', async () => {
    for (const p of ADMIN_PATHS) {
      const r = await get(p, ADMIN());
      expect(r.status, `admin ${p}`).toBe(200);
    }
  });

  it('a non-admin (sales-mgr) is 403 on every admin area', async () => {
    for (const p of ADMIN_PATHS) {
      const r = await get(p, NON_ADMIN());
      expect(r.status, `non-admin ${p}`).toBe(403);
    }
  });

  it('per the group-admin-only policy, even sys-integrator is 403', async () => {
    const r = await get('/integrations', SYS_INT());
    expect(r.status).toBe(403);
  });

  it('non-admins still reach their own non-admin surfaces', async () => {
    expect((await get('/cards?track=sales', NON_ADMIN())).status).toBe(200);
    expect((await get('/me/permissions', NON_ADMIN())).status).toBe(200);
  });
});
