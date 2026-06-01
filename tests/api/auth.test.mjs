import { describe, it, expect } from 'vitest';
import { get, post, ADMIN } from '../helpers.mjs';

describe('auth', () => {
  it('health is public', async () => {
    const r = await get('/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it('rejects unauthenticated access to a secured route', async () => {
    const r = await get('/cards?track=sales');
    expect(r.status).toBe(401);
  });

  it('logs in with seeded credentials', async () => {
    const r = await post('/auth/login', { email: 'm.weber@group.eu', password: 'demo1234' });
    expect(r.status).toBe(200);
    expect(typeof r.body.token).toBe('string');
    expect(r.body.user.email).toBe('m.weber@group.eu');
  });

  it('rejects bad credentials', async () => {
    const r = await post('/auth/login', { email: 'm.weber@group.eu', password: 'wrong' });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('returns the current user from a valid token', async () => {
    const r = await get('/auth/me', ADMIN());
    expect(r.status).toBe(200);
    expect(r.body.roleId).toBe('group-admin');
  });
});
