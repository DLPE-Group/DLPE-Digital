import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

// Load the repo-root .env (server/src/env.ts -> repo root is ../../..).
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../.env') });
// Also load a local server/.env if present (no-op when it's a symlink to root).
loadDotenv({ path: resolve(__dirname, '../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  AUTH_PROVIDER: z.string().default('jwt'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  PORT: z.coerce.number().default(4000),
  VITE_API_URL: z.string().default('/api'),
  // Comma-separated allowlist of origins for CORS in production
  // (e.g. "https://console.example.com,https://admin.example.com").
  // Empty in production => no cross-origin requests are reflected (same-origin only).
  CORS_ORIGIN: z.string().optional().default(''),
  // Absolute path to the built frontend (app/dist) served from the API.
  // Empty => fall back to the app dist resolved relative to this file.
  STATIC_DIR: z.string().optional().default(''),
  // Force static SPA serving even outside NODE_ENV=production
  // (accepts "1"/"true"). In production static serving is on by default.
  SERVE_STATIC: z.string().optional().default(''),
  // Non-superuser connection used to SERVE requests (RLS-enforced). Empty =>
  // fall back to DATABASE_URL (no RLS isolation; fine for single-tenant dev).
  APP_DATABASE_URL: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const appDatabaseUrl = env.APP_DATABASE_URL || env.DATABASE_URL;

export const isProd = env.NODE_ENV === 'production';
export const serveStatic = isProd || env.SERVE_STATIC === '1' || env.SERVE_STATIC === 'true';

/** Origins allowlist parsed from CORS_ORIGIN (comma-separated). */
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
