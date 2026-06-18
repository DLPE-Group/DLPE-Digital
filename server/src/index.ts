import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { env, isProd, serveStatic, corsOrigins } from './env.js';
import { requireAuth } from './auth/middleware.js';
import { requireAdmin } from './auth/preview.js';
import { tenantContext } from './auth/tenantContext.js';
import { dataModelRouter } from './routes/dataModel.js';

import { authRouter } from './routes/auth.js';
import { cardsRouter } from './routes/cards.js';
import { reportsRouter } from './routes/reports.js';
import { aggregationsRouter } from './routes/aggregations.js';
import { auditRouter } from './routes/audit.js';
import { integrationsRouter } from './routes/integrations.js';
import { structureRouter } from './routes/structure.js';
import { rolesRouter } from './routes/roles.js';
import { usersRouter } from './routes/users.js';
import { fieldRulesRouter } from './routes/fieldRules.js';
import { stageConfigRouter } from './routes/stageConfig.js';
import { triggersRouter } from './routes/triggers.js';
import { dashboardRouter } from './routes/dashboard.js';
import { permissionsRouter } from './routes/permissions.js';
import { preferencesRouter } from './routes/preferences.js';
import { fleetRouter } from './routes/fleet.js';
import { notificationsRouter } from './routes/notifications.js';
import { searchRouter } from './routes/search.js';
import { recordsRouter } from './routes/records.js';
import { platformRouter } from './routes/platform.js';
import { requirePlatformAdmin } from './auth/platform.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind a reverse proxy / load balancer in prod

// --- Structured request logging ---
app.use(
  pinoHttp(
    isProd
      ? { redact: ['req.headers.authorization', 'req.headers.cookie'] }
      : { transport: { target: 'pino-pretty', options: { singleLine: true } } },
  ),
);

// --- Security headers ---
// CSP disabled so the bundled SPA (module script + hashed assets) loads freely.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// --- CORS ---
// Dev: permissive (so the Vite dev proxy / a separate origin works).
// Prod: reflect only the configured allowlist; empty allowlist => same-origin only.
if (!isProd) {
  app.use(cors({ origin: true, credentials: true }));
} else if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins, credentials: true }));
}

app.use(express.json({ limit: '2mb' }));

// --- Rate limiting ---
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  // Relaxed under test so the suite can log in repeatedly without tripping it.
  limit: env.NODE_ENV === 'test' ? 100000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

// Health check — unauthenticated, not rate-limited.
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Interactive API docs (Swagger UI) — dev only, unauthenticated, before the
// rate limiter and auth gate so the page + spec load freely.
if (!isProd) {
  const { mountApiDocs } = await import('./openapi/mount.js');
  mountApiDocs(app);
  console.log('API docs available at /api/docs');
}

app.use('/api', apiLimiter);

// Login is the only unauthenticated route under /api/auth (rate-limited harder).
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);
app.use('/api', tenantContext);

app.use('/api/platform', requirePlatformAdmin, platformRouter);

app.use('/api/cards', cardsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/aggregations', aggregationsRouter);

// Admin-only areas (group-admin): the full audit trail, integration config,
// and every /api/admin/* surface. Enforced server-side in addition to the
// hidden frontend nav.
app.use('/api/audit', requireAdmin, auditRouter);
app.use('/api/integrations', requireAdmin, integrationsRouter);
app.use('/api/admin', requireAdmin);
app.use('/api/admin', dataModelRouter);
app.use('/api/admin', structureRouter);
app.use('/api/admin', rolesRouter);
app.use('/api/admin', usersRouter);
app.use('/api/admin', fieldRulesRouter);
app.use('/api/admin', stageConfigRouter);
app.use('/api/admin', triggersRouter);
app.use('/api', fleetRouter);
app.use('/api', notificationsRouter);
app.use('/api', searchRouter);
app.use('/api/records', recordsRouter);
app.use('/api/me', dashboardRouter);
app.use('/api/me', permissionsRouter);
app.use('/api/me', preferencesRouter);

// --- Serve the built frontend (production / SERVE_STATIC) ---
// Default to the app's built dist resolved relative to this file
// (works both as src via tsx and as the bundled dist/index.js).
if (serveStatic) {
  const staticDir = env.STATIC_DIR || resolve(__dirname, '../../app/dist');
  const indexHtml = join(staticDir, 'index.html');
  if (existsSync(indexHtml)) {
    app.use(express.static(staticDir));
    // SPA fallback for any non-API GET route.
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(indexHtml));
    console.log(`Serving frontend from ${staticDir}`);
  } else {
    console.warn(`SERVE_STATIC is on but no build at ${indexHtml} — skipping static serving.`);
  }
}

app.listen(env.PORT, () => {
  console.log(`Intelligence Layer API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
