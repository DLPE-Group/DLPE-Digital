import { Router } from 'express';
import { z } from 'zod';
import { listCards, getCard, moveStage, patchCard, createCard, deleteCard } from '../domain/cards.service.js';
import { runAction, type ActionName } from '../domain/actions.js';
import { actingUserId } from '../auth/preview.js';
import { withTenant } from '../db/withTenant.js';

export const cardsRouter: Router = Router();

function actor(req: { user?: { name: string; roleId: string; id?: string } }) {
  return { name: req.user?.name ?? 'Unknown', roleId: req.user?.roleId ?? 'unknown', userId: req.user?.id };
}

cardsRouter.get('/', async (req, res) => {
  const track = typeof req.query.track === 'string' ? req.query.track : undefined;
  try {
    const userId = actingUserId(req);
    const cards = await withTenant(req.tenantId!, (tx) => listCards(track, userId, tx));
    res.json(cards);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

const createCardSchema = z.object({
  track: z.string().min(1),
  customer: z.string().min(1),
  type: z.string().optional(),
  value: z.number().nullable().optional(),
  vehicle: z.string().nullable().optional(),
  sub: z.string().optional(),
  stageId: z.string().optional(),
  owner: z.string().optional(),
  status: z.string().optional(),
  companyId: z.string().nullable().optional(),
});
cardsRouter.post('/', async (req, res) => {
  const parsed = createCardSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  try {
    res.json(await createCard(parsed.data, actor(req)));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

cardsRouter.delete('/:id', async (req, res) => {
  try {
    await deleteCard(req.params.id, actor(req));
    res.json({ ok: true });
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
