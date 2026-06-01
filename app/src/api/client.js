// Tiny API client for the Intelligence Layer backend.
// Base path is proxied to the Express server (see vite.config.js).
const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'il_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function apiFetch(path, opts = {}) {
  const headers = { 'content-type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;

  const body = opts.body != null && typeof opts.body !== 'string'
    ? JSON.stringify(opts.body)
    : opts.body;

  const res = await fetch(BASE + path, { ...opts, headers, body });

  if (res.status === 401) {
    setToken(null);
    if (onUnauthorized) onUnauthorized();
    throw new Error('Unauthorized');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || res.statusText);
  return data;
}

export const api = {
  get:   (p)       => apiFetch(p),
  post:  (p, body) => apiFetch(p, { method: 'POST',   body }),
  put:   (p, body) => apiFetch(p, { method: 'PUT',    body }),
  patch: (p, body) => apiFetch(p, { method: 'PATCH',  body }),
  del:   (p)       => apiFetch(p, { method: 'DELETE' }),
};
