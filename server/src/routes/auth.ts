import { Router } from 'express';
import { z } from 'zod';
import { authProvider } from '../auth/JwtAuthProvider.js';
import { requireAuth } from '../auth/middleware.js';

export const authRouter: Router = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'email and password required' });
  try {
    const result = await authProvider.login(parsed.data.email, parsed.data.password);
    res.json(result);
  } catch {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

authRouter.post('/refresh', async (req, res) => {
  const token = req.body?.refreshToken;
  if (!token) return res.status(400).json({ error: 'refreshToken required' });
  try {
    const result = await authProvider.refresh!(token);
    res.json(result);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

authRouter.post('/logout', async (req, res) => {
  const token = req.body?.refreshToken;
  if (token) await authProvider.logout?.(token);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(req.user);
});
