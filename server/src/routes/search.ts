import { Router } from 'express';
import { prisma } from '../prisma.js';
import { TRACK_KEY_FROM_ENUM } from '@dlpe/shared';
import { loadPipelineCards } from '../domain/cards.service.js';
import { entityToVehicleDTO, type EntityRow } from '../domain/projection.js';

// GET /search?q= — cross-entity search over pipeline + reference entities.
export const searchRouter: Router = Router();

searchRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) return res.json({ q, results: [] });
  const ql = q.toLowerCase();
  const has = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(ql);

  const cards = (await loadPipelineCards())
    .filter((c) => has(c.customer) || has(c.vehicle) || has(c.sub) || has(c.stageName))
    .slice(0, 6);

  const vehicleRows = await prisma.entity.findMany({
    where: { entityType: { key: 'vehicle' } },
    orderBy: { title: 'asc' },
  });
  const vehicles = vehicleRows
    .map((r) => entityToVehicleDTO(r as unknown as EntityRow))
    .filter((v) => has(v.plate) || has(v.model) || has(v.operator))
    .slice(0, 6);

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
