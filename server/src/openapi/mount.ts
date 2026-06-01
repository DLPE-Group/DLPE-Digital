import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './index.js';

// Mounts interactive API docs at /api/docs and the raw spec at
// /api/docs.json. Call BEFORE the auth middleware so the docs page itself
// needs no token (individual "try it out" calls still send the bearer token).
export function mountApiDocs(app: Express): void {
  const document = buildOpenApiDocument();
  app.get('/api/docs.json', (_req, res) => res.json(document));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'DLPE Intelligence Layer API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );
}
