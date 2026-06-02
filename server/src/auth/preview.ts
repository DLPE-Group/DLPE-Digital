import type { Request, Response, NextFunction } from 'express';

// Single source of truth for "admin" across the API: group-admin only.
// Gates the admin/integrations/audit areas, preview-as, and the records
// preview overrides.
export const ADMIN_ROLE_IDS = new Set(['group-admin']);

export function isAdmin(req: Request): boolean {
  return !!req.user && ADMIN_ROLE_IDS.has(req.user.roleId);
}

// Express guard: 403 for anyone who isn't an admin. Mount before admin-only
// route groups (defense-in-depth alongside the hidden frontend nav).
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!ADMIN_ROLE_IDS.has(req.user.roleId)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// The user id whose data/permissions a request should be served as.
// Admins may preview the product as another user via the `x-preview-as` header
// (the dashboard preview banner). Everyone else is always served as themselves,
// so the header can never be used to escalate access.
export function actingUserId(req: Request): string | undefined {
  const previewAs = req.header('x-preview-as');
  if (previewAs && req.user && ADMIN_ROLE_IDS.has(req.user.roleId)) return previewAs;
  return req.user?.id;
}
