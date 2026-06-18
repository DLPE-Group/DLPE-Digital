import type { Request, Response, NextFunction } from 'express';

export function isPlatformAdmin(req: Request): boolean {
  return !!req.user?.platformAdmin;
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!req.user.platformAdmin) {
    res.status(403).json({ error: 'Platform admin access required' });
    return;
  }
  next();
}
