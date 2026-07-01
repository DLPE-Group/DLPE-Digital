// TEST-ONLY fixture: a second, NON-FLEET tenant provisioned alongside the demo.
// It has one custom track ('projects') and a pipeline type, but NO 'vehicle' or
// 'fleet_operator' reference types — so the UI must hide the Vehicles / Timelines
// / Customer-portal surfaces for it (the negative gating cases), while still
// rendering its own track. Run by tests/prepare-db.mjs after the demo seed.
//
// NOT loaded in production — only the isolated test DB (intelligence_test).
import { PrismaClient } from '@prisma/client';
import { SPEC_VERSION } from '@dlpe/shared';
import { provisionTenant } from '../src/domain/provisioning/provisionTenant.js';
import { SharedDbTarget } from '../src/domain/provisioning/target.js';

const prisma = new PrismaClient();

// Minimal, genuinely non-fleet blueprint: one track, one pipeline type, no
// reference (vehicle / fleet_operator) types, empty seed (gating tests don't
// need cards — a card can be created through the API/UI in-test).
const spec = {
  specVersion: SPEC_VERSION,
  inputs: [],
  orgStructure: {
    id: 'nf-grp',
    kind: 'group' as const,
    name: 'TestCo (Non-fleet)',
    children: [{ id: 'nf-co', kind: 'company' as const, name: 'TestCo Ltd', children: [] }],
  },
  roles: [
    { id: 'nf-group-admin', name: 'Administrator', system: true, tracks: ['All tracks'], edit: 'all', desc: 'Full access' },
  ],
  fieldRules: [],
  tracks: [
    {
      key: 'projects',
      label: 'Projects',
      color: 'var(--track-sales)',
      order: 0,
      builtin: true,
      stages: [
        { stageId: 'todo', label: 'To do', sla: 5, cta: 'Start', order: 0 },
        { stageId: 'doing', label: 'In progress', sla: 10, cta: 'Advance', order: 1 },
        { stageId: 'done', label: 'Done', sla: 0, cta: 'Close', order: 2 },
      ],
    },
  ],
  entityTypes: [
    { key: 'project', label: 'Project', kind: 'pipeline' as const, trackKey: 'projects', order: 0, builtin: true, fields: [] },
  ],
  crossTriggers: [],
  branding: { name: 'TestCo (Non-fleet)' },
  integrations: [],
  adminUser: {
    idPrefix: 'u-nf-admin',
    name: 'NonFleet Admin',
    email: 'admin@testco.test',
    roleId: 'nf-group-admin',
    scopeType: 'group',
    password: 'demo1234',
  },
};

await provisionTenant({
  blueprint: { spec: spec as never },
  inputs: { slug: 'testco-nonfleet', customerName: 'TestCo (Non-fleet)', region: 'eu' },
  target: new SharedDbTarget(),
  tenantId: 'testco-nonfleet',
  idempotencyKey: 'seed-testco-nonfleet',
  idMode: 'literal',
  prismaClient: prisma,
});

console.log('[seed-nonfleet] provisioned non-fleet tenant (admin@testco.test / demo1234)');
await prisma.$disconnect();
