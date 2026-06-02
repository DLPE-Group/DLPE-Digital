import { Router } from 'express';
import { z } from 'zod';
import { listCards, getCard, moveStage, patchCard } from '../domain/cards.service.js';
import { runAction, type ActionName } from '../domain/actions.js';
import { actingUserId } from '../auth/preview.js';

export const cardsRouter: Router = Router();

function actor(req: { user?: { name: string; roleId: string } }) {
  return { name: req.user?.name ?? 'Unknown', roleId: req.user?.roleId ?? 'unknown' };
}

cardsRouter.get('/', async (req, res) => {
  const track = typeof req.query.track === 'string' ? req.query.track : undefined;
  try {
    res.json(await listCards(track, actingUserId(req)));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

cardsRouter.get('/:id', async (req, res) => {
  const card = await getCard(req.params.id, actingUserId(req));
  if (!card) return res.status(404).json({ error: 'Card not found' });
  res.json(card);
});

export const stageSchema = z.object({ stageId: z.string().min(1) });
cardsRouter.put('/:id/stage', async (req, res) => {
  const parsed = stageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'stageId required' });
  try {
    res.json(await moveStage(req.params.id, parsed.data.stageId, actor(req), req.user?.id));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

cardsRouter.patch('/:id', async (req, res) => {
  try {
    res.json(await patchCard(req.params.id, req.body ?? {}));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

const ACTIONS = new Set<ActionName>([
  'sendFollowUp',
  'signContract',
  'planWorkshopVisit',
  'generateInvoice',
  'sendDunning',
  'approvePeppol',
  'notifyPickup',
]);

cardsRouter.post('/:id/actions/:action', async (req, res) => {
  const action = req.params.action as ActionName;
  if (!ACTIONS.has(action)) return res.status(400).json({ error: `Unknown action: ${action}` });
  try {
    const result = await runAction(req.params.id, action, req.body?.state ?? {}, actor(req));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
