import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const preferencesRouter: Router = Router();

// Defaults mirror the Settings → Notifications & rules toggles.
const DEFAULTS = {
  enforceLocks: true,
  peppol: true,
  emailNotif: true,
  slackNotif: false,
  dailyDigest: true,
  autoEscalate: true,
};

export const prefsSchema = z
  .object({
    enforceLocks: z.boolean(),
    peppol: z.boolean(),
    emailNotif: z.boolean(),
    slackNotif: z.boolean(),
    dailyDigest: z.boolean(),
    autoEscalate: z.boolean(),
  })
  .partial();

// GET /me/preferences — the caller's saved toggles (defaults if never saved).
preferencesRouter.get('/preferences', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const row = await prisma.userPreference.findUnique({ where: { userId } });
  res.json({ ...DEFAULTS, ...((row?.prefs as object) ?? {}) });
});

// PUT /me/preferences — upsert the caller's toggles (merged over existing).
preferencesRouter.put('/preferences', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const parsed = prefsSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid preferences' });
  const existing = await prisma.userPreference.findUnique({ where: { userId } });
  const merged = { ...DEFAULTS, ...((existing?.prefs as object) ?? {}), ...parsed.data };
  const row = await prisma.userPreference.upsert({
    where: { userId },
    update: { prefs: merged },
    create: { userId, prefs: merged, tenantId: req.tenantId! },
  });
  res.json(row.prefs);
});
