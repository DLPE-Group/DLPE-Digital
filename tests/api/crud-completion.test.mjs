import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, post, patch, del, req, token, ADMIN, TEST_DB_URL } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(async () => {
  await prisma.entity.deleteMany({ where: { title: 'CRUD Test Co' } });
  await prisma.user.deleteMany({ where: { email: 'crud.temp@group.eu' } });
  await prisma.role.deleteMany({ where: { id: { in: ['tmprole'] } } });
  await prisma.orgNode.deleteMany({ where: { id: 'reg-crudtest' } });
  await prisma.$disconnect();
});

describe('Roles CRUD', () => {
  it('rename + delete a custom role; system role delete blocked', async () => {
    expect((await post('/admin/roles', { id: 'tmprole', name: 'Temp role' }, ADMIN())).status).toBe(200);
    const r = await patch('/admin/roles/tmprole', { name: 'Renamed role' }, ADMIN());
    expect(r.status).toBe(200); expect(r.body.name).toBe('Renamed role');
    expect((await del('/admin/roles/tmprole', ADMIN())).status).toBe(200);
    expect((await del('/admin/roles/group-admin', ADMIN())).status).toBe(400); // system
  });
});

describe('Users deactivate', () => {
  it('deactivates a user (blocks login), reactivates; cannot self-deactivate', async () => {
    const created = await post('/admin/users', { name: 'CRUD Temp', email: 'crud.temp@group.eu', roleId: 'sales-rep' }, ADMIN());
    expect(created.status).toBe(200);
    const id = created.body.id;
    const userTok = token(id, 'crud.temp@group.eu', 'sales-rep');
    expect((await get('/me/permissions', userTok)).status).toBe(200); // active → ok

    expect((await patch(`/admin/users/${id}`, { status: 'disabled' }, ADMIN())).status).toBe(200);
    expect((await get('/me/permissions', userTok)).status).toBe(401); // disabled → blocked

    expect((await patch(`/admin/users/${id}`, { status: 'active' }, ADMIN())).status).toBe(200);
    expect((await get('/me/permissions', userTok)).status).toBe(200); // re-enabled

    // admin cannot deactivate themselves
    expect((await patch('/admin/users/u-robert', { status: 'disabled' }, ADMIN())).status).toBe(400);
  });
});

describe('Structure CRUD', () => {
  it('adds a region and deletes it; blocks deleting a node with children', async () => {
    const tree = await get('/admin/structure', ADMIN());
    const groupId = tree.body.id;
    const add = await req('POST', `/admin/structure/${groupId}/nodes`, { body: { kind: 'REGION', name: 'CrudTest', code: 'crudtest' }, tok: ADMIN() });
    expect(add.status).toBe(200);
    expect(add.body.id).toBe('reg-crudtest');
    expect((await del('/admin/structure/reg-crudtest', ADMIN())).status).toBe(200);
    // a country with companies cannot be deleted
    expect((await del('/admin/structure/co-nl', ADMIN())).status).toBe(400);
  });
});

describe('Integrations + Triggers CRUD', () => {
  it('deletes an integration', async () => {
    const created = await post('/integrations', { name: 'Temp Connector' }, ADMIN());
    expect(created.status).toBe(200);
    expect((await del(`/integrations/${created.body.id}`, ADMIN())).status).toBe(200);
  });
  it('edits a trigger via PATCH', async () => {
    const created = await post('/admin/triggers', { whenTrack: 'sales', whenStage: 'X', thenTrack: 'finance', thenStage: 'Y', note: 'tmp' }, ADMIN());
    const upd = await patch(`/admin/triggers/${created.body.id}`, { note: 'edited' }, ADMIN());
    expect(upd.status).toBe(200); expect(upd.body.note).toBe('edited');
    await del(`/admin/triggers/${created.body.id}`, ADMIN());
  });
});

describe('Records (entity) CRUD', () => {
  it('creates a pipeline item, lists it, deletes it', async () => {
    const created = await post('/cards', { track: 'sales', customer: 'CRUD Test Co', value: 5000 }, ADMIN());
    expect(created.status).toBe(200);
    expect(created.body.track).toBe('SALES');
    expect(created.body.customer).toBe('CRUD Test Co');
    const id = created.body.id;

    const list = await get('/cards?track=sales', ADMIN());
    expect(list.body.some((c) => c.id === id)).toBe(true);

    expect((await del(`/cards/${id}`, ADMIN())).status).toBe(200);
    const after = await get('/cards?track=sales', ADMIN());
    expect(after.body.some((c) => c.id === id)).toBe(false);
  });

  it('record CRUD is admin-gated? (cards are not admin-only — any authed user)', async () => {
    // /cards is not under /admin, so a normal user can create within their access.
    const r = await post('/cards', { track: 'sales', customer: 'CRUD Test Co', value: 1 }, token('u-markus', 'm.weber@group.eu', 'sales-mgr'));
    expect(r.status).toBe(200);
  });
});
