import type { Request, Response, NextFunction } from 'express';
import { authProvider } from './JwtAuthProvider.js';
import type { AuthUser } from './AuthProvider.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  try {
    req.user = await authProvider.verify(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
