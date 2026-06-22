// Long-running command for Playwright's webServer: prepare the test DB, build
// the SPA, then run the API server (serving the SPA same-origin) on :4100.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TEST_PORT, TEST_DB_URL, TEST_JWT_SECRET, TEST_JWT_REFRESH } from './helpers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const serverDir = resolve(root, 'server');

// 1. reset+seed test DB
const prep = spawnSync('node', [resolve(here, 'prepare-db.mjs')], { stdio: 'inherit' });
if (prep.status !== 0) process.exit(prep.status ?? 1);

// 2. build the SPA so the server can serve it same-origin
const build = spawnSync('npm', ['--workspace', 'app', 'run', 'build'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

// 3. run the server in the foreground (Playwright manages its lifecycle)
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
const r = spawnSync('npx', ['tsx', 'src/index.ts'], { cwd: serverDir, env, stdio: 'inherit' });
process.exit(r.status ?? 0);
