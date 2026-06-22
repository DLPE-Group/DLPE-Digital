// Vitest globalSetup: prepare the isolated test DB, boot the API server on
// :4100 (test DB, scripted AI fallback), wait for health, and tear it down.
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { BASE, TEST_PORT, TEST_DB_URL, TEST_JWT_SECRET, TEST_JWT_REFRESH } from './helpers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, '../server');

async function waitForHealth(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Test server did not become healthy in time');
}

export default async function setup() {
  // 1. Reset + seed the test DB.
  const prep = spawnSync('node', [resolve(here, 'prepare-db.mjs')], { stdio: 'inherit' });
  if (prep.status !== 0) throw new Error('prepare-db failed');

  // 2. Boot the server against the test DB.
  const env = {
    ...process.env,
    DATABASE_URL: TEST_DB_URL,
    APP_DATABASE_URL: 'postgresql://il_app:il_app_pw@localhost:5432/intelligence_test',
    PORT: String(TEST_PORT),
    NODE_ENV: 'test',
    SERVE_STATIC: '1',
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_REFRESH_SECRET: TEST_JWT_REFRESH,
    ANTHROPIC_API_KEY: '',
  };
  const child = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: serverDir,
    env,
    detached: true,
    stdio: 'ignore',
  });

  await waitForHealth();

  // 3. Teardown.
  return async () => {
    try { process.kill(-child.pid); } catch { /* already gone */ }
  };
}
