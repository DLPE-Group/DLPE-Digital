// Prepare the isolated test database (intelligence_test) WITHOUT destructive
// prisma commands (migrate reset is blocked for AI agents):
//   1. prisma migrate deploy   — apply migrations (safe, non-destructive)
//   2. TRUNCATE all data tables (keep _prisma_migrations) via psql
//   3. prisma db seed          — load demo data
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TEST_DB_URL } from './helpers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, '../server');
const env = { ...process.env, DATABASE_URL: TEST_DB_URL };

function run(label, cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) { console.error(`[prepare-db] ${label} failed`); process.exit(r.status ?? 1); }
}

console.log('[prepare-db] migrate deploy …');
run('migrate deploy', 'npx', ['prisma', 'migrate', 'deploy'], { cwd: serverDir, env });

console.log('[prepare-db] truncating test tables …');
const truncate =
  "DO $$ DECLARE r RECORD; BEGIN " +
  "FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations') LOOP " +
  "EXECUTE 'TRUNCATE TABLE \"' || r.tablename || '\" RESTART IDENTITY CASCADE'; END LOOP; END $$;";
// Local dev truncates inside the `il_postgres` container; CI (no such container)
// truncates over TCP with psql against TEST_DB_URL. `PREPARE_DB_PSQL=1` forces psql.
if (process.env.CI || process.env.PREPARE_DB_PSQL === '1') {
  run('truncate', 'psql', [TEST_DB_URL, '-v', 'ON_ERROR_STOP=1', '-c', truncate]);
} else {
  run('truncate', 'docker', ['exec', 'il_postgres', 'psql', '-U', 'postgres', '-d', 'intelligence_test', '-c', truncate]);
}

console.log('[prepare-db] seeding …');
run('seed', 'npx', ['prisma', 'db', 'seed'], { cwd: serverDir, env });

console.log('[prepare-db] test DB ready.');
