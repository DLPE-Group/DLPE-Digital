import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { requireAuth } from './auth/middleware.js';

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

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Health check — unauthenticated.
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Login is the only unauthenticated route under /api/auth.
// Everything else under /api requires a bearer token.
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);

app.use('/api/cards', cardsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/aggregations', aggregationsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/admin', structureRouter);
app.use('/api/admin', rolesRouter);
app.use('/api/admin', usersRouter);
app.use('/api/admin', fieldRulesRouter);
app.use('/api/admin', stageConfigRouter);
app.use('/api/admin', triggersRouter);
app.use('/api/me', dashboardRouter);
app.use('/api/me', permissionsRouter);

app.listen(env.PORT, () => {
  console.log(`Intelligence Layer API listening on http://localhost:${env.PORT}`);
});
