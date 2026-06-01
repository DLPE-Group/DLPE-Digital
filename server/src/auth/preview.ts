import type { Request } from 'express';

// Roles allowed to "preview as" another user (server-enforced).
export const ADMIN_ROLE_IDS = new Set(['group-admin', 'sys-integrator', 'country-mgr']);

// The user id whose data/permissions a request should be served as.
// Admins may preview the product as another user via the `x-preview-as` header
// (the dashboard preview banner). Everyone else is always served as themselves,
// so the header can never be used to escalate access.
export function actingUserId(req: Request): string | undefined {
  const previewAs = req.header('x-preview-as');
  if (previewAs && req.user && ADMIN_ROLE_IDS.has(req.user.roleId)) return previewAs;
  return req.user?.id;
}
