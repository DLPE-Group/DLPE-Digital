import { Router } from 'express';
import { prisma } from '../prisma.js';
import { TRACK_KEY_FROM_ENUM } from '@dlpe/shared';

// GET /search?q= — cross-entity search over cards + vehicles.
export const searchRouter: Router = Router();

searchRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) return res.json({ q, results: [] });
  const ci = { contains: q, mode: 'insensitive' as const };

  const [cards, vehicles] = await Promise.all([
    prisma.card.findMany({
      where: { OR: [{ customer: ci }, { vehicle: ci }, { sub: ci }, { stageName: ci }] },
      take: 6, orderBy: { id: 'asc' },
    }),
    prisma.vehicle.findMany({
      where: { OR: [{ plate: ci }, { model: ci }, { operator: ci }] },
      take: 6, orderBy: { plate: 'asc' },
    }),
  ]);

  const results = [
    ...cards.map((c) => ({
      type: 'card', id: c.id, track: TRACK_KEY_FROM_ENUM[c.track],
      label: c.customer, sub: `${c.stageName}${c.vehicle ? ` · ${c.vehicle}` : ''}`,
    })),
    ...vehicles.map((v) => ({
      type: 'vehicle', id: v.id, track: 'workshop',
      label: v.plate, sub: `${v.model ?? ''}${v.operator ? ` · ${v.operator}` : ''}`,
    })),
  ];
  res.json({ q, results });
});
