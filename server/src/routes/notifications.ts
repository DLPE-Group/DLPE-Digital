import { Router } from 'express';
import { prisma } from '../prisma.js';
import { TRACK_KEY_FROM_ENUM } from '@dlpe/shared';
import { loadPipelineCards } from '../domain/cards.service.js';

// In-app notifications, DERIVED from live DB state (no external delivery).
// - red-status cards  → risk alerts
// - recent critical audit entries (cascades) → activity alerts
export const notificationsRouter: Router = Router();

notificationsRouter.get('/notifications', async (_req, res) => {
  const [allCards, criticals] = await Promise.all([
    loadPipelineCards(),
    prisma.auditEntry.findMany({ where: { kind: 'critical' }, orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);
  const redCards = allCards.filter((c) => c.status === 'red');

  const items = [
    ...redCards.map((c) => ({
      id: `card-${c.id}`,
      kind: 'risk',
      icon: 'flash',
      track: TRACK_KEY_FROM_ENUM[c.track],
      title: `${c.customer} at risk`,
      body: `${c.sub || c.stageName}${c.value ? ` · €${(c.value / 1e6).toFixed(2)}M` : ''}`,
      when: c.daysLabel || '',
    })),
    ...criticals.map((a) => ({
      id: `audit-${a.id}`,
      kind: 'activity',
      icon: a.icon || 'bolt',
      track: a.track,
      title: a.verb,
      body: a.target,
      when: `${a.day} · ${a.time}`,
    })),
  ];

  res.json(items);
});
