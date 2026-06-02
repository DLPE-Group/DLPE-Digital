// Shared test config + helpers for the API/UI suites.
import jwt from 'jsonwebtoken';

export const TEST_PORT = 4100;
export const BASE = `http://localhost:${TEST_PORT}`;
export const API = `${BASE}/api`;
export const TEST_JWT_SECRET = 'test-secret';
export const TEST_JWT_REFRESH = 'test-refresh';
export const TEST_DB_URL =
  'postgresql://postgres:postgres@localhost:5432/intelligence_test';

// Mint a JWT directly (avoids hammering the login endpoint). The server
// re-loads the user from the DB by `sub`, so the user must exist in the seed.
export function token(sub = 'u-robert', email = 'r.mertens@group.eu', roleId = 'group-admin') {
  return jwt.sign({ sub, email, roleId }, TEST_JWT_SECRET, { expiresIn: '30m' });
}

// Seeded principals for RBAC-flavoured tests.
export const ADMIN = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
export const SALES_MGR = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');

export async function req(method, path, { body, tok, headers: extra } = {}) {
  const headers = { 'content-type': 'application/json', ...(extra || {}) };
  if (tok) headers.authorization = `Bearer ${tok}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

export const get = (p, tok) => req('GET', p, { tok });
export const post = (p, body, tok) => req('POST', p, { body, tok });
export const put = (p, body, tok) => req('PUT', p, { body, tok });
export const patch = (p, body, tok) => req('PATCH', p, { body, tok });
export const del = (p, tok) => req('DELETE', p, { tok });
