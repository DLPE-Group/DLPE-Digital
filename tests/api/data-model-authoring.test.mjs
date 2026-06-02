import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, post, patch, del, req, token, ADMIN, TEST_DB_URL } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const NON_ADMIN = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');

// Clean up the rows these tests create so the exact-count read test is unaffected.
afterAll(async () => {
  await prisma.entityType.deleteMany({ where: { key: 'claim' } }); // cascades fieldDefs
  await prisma.trackDef.deleteMany({ where: { key: 'insurance' } });
  await prisma.$disconnect();
});

describe('no-code authoring (data model)', () => {
  it('creates a track, a pipeline type on it, and a field', async () => {
    expect((await post('/admin/data-model/tracks', { key: 'insurance', label: 'Insurance', color: '#39c' }, ADMIN())).status).toBe(200);

    const type = await post('/admin/data-model/types', { key: 'claim', label: 'Claim', kind: 'pipeline', trackKey: 'insurance' }, ADMIN());
    expect(type.status).toBe(200);

    const field = await post('/admin/data-model/types/claim/fields', { key: 'premium', label: 'Premium', category: 'Financial', dataKind: 'money' }, ADMIN());
    expect(field.status).toBe(200);

    const model = await get('/admin/data-model', ADMIN());
    const claim = model.body.types.find((t) => t.key === 'claim');
    expect(claim.trackKey).toBe('insurance');
    expect(claim.fields.map((f) => f.key)).toContain('premium');
  });

  it('renames a type via PATCH', async () => {
    const r = await patch('/admin/data-model/types/claim', { label: 'Insurance claim' }, ADMIN());
    expect(r.status).toBe(200);
    expect(r.body.label).toBe('Insurance claim');
  });

  it('deletes a non-builtin field', async () => {
    expect((await del('/admin/data-model/types/claim/fields/premium', ADMIN())).status).toBe(200);
    const model = await get('/admin/data-model', ADMIN());
    expect(model.body.types.find((t) => t.key === 'claim').fields.map((f) => f.key)).not.toContain('premium');
  });

  it('refuses to delete a built-in field', async () => {
    const r = await del('/admin/data-model/types/contract/fields/contract_value', ADMIN());
    expect(r.status).toBe(400);
    // and it is still there
    const model = await get('/admin/data-model', ADMIN());
    expect(model.body.types.find((t) => t.key === 'contract').fields.map((f) => f.key)).toContain('contract_value');
  });

  it('rejects duplicate keys (409) and bad keys (400)', async () => {
    expect((await post('/admin/data-model/types', { key: 'contract', label: 'Dup', kind: 'pipeline', trackKey: 'sales' }, ADMIN())).status).toBe(409);
    expect((await post('/admin/data-model/tracks', { key: 'Bad Key', label: 'x' }, ADMIN())).status).toBe(400);
  });

  it('is admin-only (non-admin gets 403)', async () => {
    const r = await req('POST', '/admin/data-model/types', { body: { key: 'sneaky', label: 'x', kind: 'reference' }, tok: NON_ADMIN() });
    expect(r.status).toBe(403);
  });
});
