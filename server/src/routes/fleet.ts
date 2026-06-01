import { Router } from 'express';
import { prisma } from '../prisma.js';

// Exposes the already-seeded Vehicle / Invoice / FleetOperator / VehicleTimeline
// models that the frontend previously only read from seed constants.
export const fleetRouter: Router = Router();

// GET /vehicles?status=&q= — fleet vehicles (real rows).
fleetRouter.get('/vehicles', async (req, res) => {
  const where: { status?: string } = {};
  if (typeof req.query.status === 'string') where.status = req.query.status;
  let rows = await prisma.vehicle.findMany({ where, orderBy: { plate: 'asc' } });
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : '';
  if (q) rows = rows.filter((v) => `${v.plate} ${v.model ?? ''} ${v.operator ?? ''}`.toLowerCase().includes(q));
  res.json(rows);
});

// GET /vehicles/timeline — the seeded vehicle lifecycle drill-down (first one).
fleetRouter.get('/vehicles/timeline', async (_req, res) => {
  const t = await prisma.vehicleTimeline.findFirst({
    include: { events: { orderBy: { order: 'asc' } } },
  });
  if (!t) return res.status(404).json({ error: 'No timeline found' });
  res.json(t);
});

// GET /portal — the customer-facing fleet view, scoped to one operator
// (operator + its vehicles + invoices + messages).
fleetRouter.get('/portal', async (_req, res) => {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { plate: 'asc' } });
  const operatorName = vehicles.find((v) => v.operator)?.operator ?? null;
  const operator = operatorName
    ? await prisma.fleetOperator.findFirst({ where: { name: operatorName } })
    : await prisma.fleetOperator.findFirst();
  const opVehicles = operatorName ? vehicles.filter((v) => v.operator === operatorName) : vehicles;
  const invoices = operator?.companyId
    ? await prisma.invoice.findMany({ where: { companyId: operator.companyId }, orderBy: { ref: 'asc' } })
    : await prisma.invoice.findMany({ orderBy: { ref: 'asc' } });
  // Portal messages are added in Package F (PortalMessage model).
  res.json({
    operator: operator?.name ?? 'Fleet operator',
    contact: operator?.contact ?? '',
    vehicles: opVehicles,
    invoices,
    messages: [],
  });
});
