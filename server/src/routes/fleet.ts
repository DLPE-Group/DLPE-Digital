import { Router } from 'express';
import { entityToVehicleDTO, type EntityRow } from '../domain/projection.js';
import { withTenant } from '../db/withTenant.js';
import type { Prisma } from '@prisma/client';

// Exposes fleet data. Vehicles are now reference Entities (entityType=vehicle),
// projected to the legacy Vehicle shape; Invoice / FleetOperator / PortalMessage
// remain their own models.
export const fleetRouter: Router = Router();

// Load reference vehicle entities projected to the legacy Vehicle DTO.
async function loadVehicleDTOs(db: Prisma.TransactionClient) {
  const rows = await db.entity.findMany({
    where: { entityType: { key: 'vehicle' } },
    orderBy: { title: 'asc' },
  });
  return rows.map((r) => entityToVehicleDTO(r as unknown as EntityRow));
}

// GET /vehicles?status=&q= — fleet vehicles (reference entities).
fleetRouter.get('/vehicles', async (req, res) => {
  let vehicles = await withTenant(req.tenantId!, (db) => loadVehicleDTOs(db));
  if (typeof req.query.status === 'string') {
    const status = req.query.status;
    vehicles = vehicles.filter((v) => v.status === status);
  }
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : '';
  if (q) vehicles = vehicles.filter((v) => `${v.plate} ${v.model ?? ''} ${v.operator ?? ''}`.toLowerCase().includes(q));
  res.json(vehicles);
});

// GET /vehicles/timeline — the seeded vehicle lifecycle drill-down (first one).
fleetRouter.get('/vehicles/timeline', async (req, res) => {
  const t = await withTenant(req.tenantId!, (db) =>
    db.vehicleTimeline.findFirst({
      include: { events: { orderBy: { order: 'asc' } } },
    }),
  );
  if (!t) return res.status(404).json({ error: 'No timeline found' });
  res.json(t);
});

// GET /portal — the customer-facing fleet view, scoped to one operator
// (operator + its vehicles + invoices + messages).
fleetRouter.get('/portal', async (req, res) => {
  const result = await withTenant(req.tenantId!, async (db) => {
    const vehicles = await loadVehicleDTOs(db);
    const operatorName = vehicles.find((v) => v.operator)?.operator ?? null;
    const operator = operatorName
      ? await db.fleetOperator.findFirst({ where: { name: operatorName } })
      : await db.fleetOperator.findFirst();
    const opVehicles = operatorName ? vehicles.filter((v) => v.operator === operatorName) : vehicles;
    const invoices = operator?.companyId
      ? await db.invoice.findMany({ where: { companyId: operator.companyId }, orderBy: { ref: 'asc' } })
      : await db.invoice.findMany({ orderBy: { ref: 'asc' } });
    const messages = await db.portalMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    return {
      operator: operator?.name ?? 'Fleet operator',
      contact: operator?.contact ?? '',
      vehicles: opVehicles,
      invoices,
      messages: messages.map((m) => ({ when: m.when, body: m.body })),
    };
  });
  res.json(result);
});

// GET /portal/messages — recent messages to the account team.
fleetRouter.get('/portal/messages', async (req, res) => {
  const rows = await withTenant(req.tenantId!, (db) =>
    db.portalMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  );
  res.json(rows);
});

// POST /portal/messages — send a message to the account team (persisted).
fleetRouter.post('/portal/messages', async (req, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'Message body required' });
  const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const row = await withTenant(req.tenantId!, (db) =>
    db.portalMessage.create({
      data: {
        operator: typeof req.body?.operator === 'string' ? req.body.operator : null,
        author: req.user?.name ?? null,
        when: `Today · ${when}`,
        body,
        tenantId: req.tenantId!,
      },
    }),
  );
  res.json(row);
});
