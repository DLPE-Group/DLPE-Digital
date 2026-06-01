// OpenAPI 3 document generated *from Zod schemas* (no hand-maintained spec).
//
// Request bodies that already had Zod schemas in the route files are imported
// and reused here (so the docs can never drift from validation). The few that
// were only declared inline (auth/users/triggers/field-rules/stage-config) are
// mirrored below with a // source: comment pointing at the route file.
//
// The generated document is served via Swagger UI at /api/docs (dev only).
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Reused request schemas (the source of truth lives in the route files).
import { specSchema } from '../routes/reports.js';
import { addSchema as integrationAddSchema } from '../routes/integrations.js';
import {
  companySchema,
  patchSchema as structurePatchSchema,
  sharingSchema,
} from '../routes/structure.js';
import { stageSchema as cardStageSchema } from '../routes/cards.js';
import { putSchema as dashboardPutSchema } from '../routes/dashboard.js';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});
const secured = [{ [bearerAuth.name]: [] as string[] }];

// ---------------------------------------------------------------------------
// Shared / mirrored schemas
// ---------------------------------------------------------------------------
const ErrorResponse = registry.register(
  'Error',
  z.object({ error: z.string() }).openapi({ description: 'Error envelope' }),
);

// A permissive object for the many endpoints that return dynamic, persistence-
// shaped JSON (Prisma rows). Documented as free-form so the UI still renders
// a "try it out" call without forcing a brittle full response schema.
const Json = z.record(z.unknown()).openapi('Json', {
  description: 'Free-form JSON object (shape depends on the resource).',
});
const JsonArray = z.array(z.record(z.unknown())).openapi('JsonArray', {
  description: 'Array of free-form JSON objects.',
});

// source: server/src/routes/auth.ts
const LoginBody = z
  .object({ email: z.string().email(), password: z.string().min(1) })
  .openapi('LoginBody');
const RefreshBody = z.object({ refreshToken: z.string() }).openapi('RefreshBody');
const UserSummary = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    roleId: z.string(),
    scopeType: z.string(),
    scopeNodeId: z.string().nullable(),
    secondaryScopes: z.array(z.unknown()),
  })
  .openapi('UserSummary');
const LoginResponse = z
  .object({ token: z.string(), refreshToken: z.string(), user: UserSummary })
  .openapi('LoginResponse');

// source: server/src/routes/users.ts
const scopeTypeEnum = z.enum([
  'group',
  'region',
  'country',
  'multi_company',
  'company',
  'self',
]);
const UserCreateBody = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    email: z.string().email(),
    initials: z.string().optional(),
    password: z.string().optional(),
    roleId: z.string().min(1),
    scopeType: scopeTypeEnum.default('company'),
    scopeNodeId: z.string().nullable().optional(),
    scopeLabel: z.string().nullable().optional(),
    status: z.enum(['active', 'invited', 'disabled']).default('active'),
  })
  .openapi('UserCreateBody');
const UserPatchBody = z
  .object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    initials: z.string().optional(),
    roleId: z.string().optional(),
    scopeType: scopeTypeEnum.optional(),
    scopeNodeId: z.string().nullable().optional(),
    scopeLabel: z.string().nullable().optional(),
    status: z.enum(['active', 'invited', 'disabled']).optional(),
  })
  .openapi('UserPatchBody');
const ScopeBody = z
  .object({
    roleId: z.string().nullable().optional(),
    scopeType: scopeTypeEnum.default('company'),
    scopeNodeId: z.string().nullable().optional(),
    scopeLabel: z.string().nullable().optional(),
    roleLabel: z.string().nullable().optional(),
  })
  .openapi('ScopeBody');

// source: server/src/routes/triggers.ts
const TriggerBody = z
  .object({
    whenTrack: z.string().min(1),
    whenStage: z.string().min(1),
    thenTrack: z.string().min(1),
    thenStage: z.string().min(1),
    note: z.string().default(''),
  })
  .openapi('TriggerBody');

// source: server/src/routes/fieldRules.ts
const RULE_SCOPES = ['ANY', 'NL', 'BE', 'DE', 'ROTTERDAM'] as const;
const FieldRule = z.object({
  roleId: z.string().min(1),
  dataTypeId: z.string().min(1),
  fieldId: z.string().min(1),
  scope: z.enum(RULE_SCOPES).default('ANY'),
  visible: z.boolean(),
  editable: z.boolean(),
  masked: z.boolean(),
  note: z.string().nullable().optional(),
});
const FieldRulesBulkBody = z
  .object({
    diffs: z.array(FieldRule),
    actor: z.string().optional(),
    note: z.string().optional(),
  })
  .openapi('FieldRulesBulkBody');

// source: server/src/routes/stageConfig.ts
const StageDef = z.object({
  stageId: z.string().min(1),
  label: z.string().min(1),
  sla: z.number().int().default(0),
  lock: z.string().nullable().optional(),
  cta: z.string().default(''),
});
const StageConfigPutBody = z
  .object({ stages: z.array(StageDef).min(1) })
  .openapi('StageConfigPutBody');

// Card patch — partial, free-form (route accepts an arbitrary patch object).
const CardPatchBody = z
  .record(z.unknown())
  .openapi('CardPatchBody', { description: 'Partial card fields to update.' });
const ActionStateBody = z
  .object({ state: z.record(z.unknown()).optional() })
  .openapi('ActionStateBody', {
    description: 'Optional action state passed to the flow handler.',
  });

// ---------------------------------------------------------------------------
// Registration helpers
// ---------------------------------------------------------------------------
const jsonContent = (schema: z.ZodTypeAny) => ({
  'application/json': { schema },
});

/** Standard responses: a 200 (with the given schema) + 400/401 error envelopes. */
function responses(okSchema: z.ZodTypeAny, okDesc = 'OK') {
  return {
    200: { description: okDesc, content: jsonContent(okSchema) },
    400: { description: 'Bad request', content: jsonContent(ErrorResponse) },
    401: { description: 'Unauthenticated', content: jsonContent(ErrorResponse) },
  };
}

// ===========================================================================
// AUTH  (login/refresh/logout are public; me is secured)
// ===========================================================================
registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Exchange credentials for a JWT (rate-limited 10 / 15min)',
  security: [],
  request: { body: { content: jsonContent(LoginBody) } },
  responses: responses(LoginResponse, 'Token + user'),
});
registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Mint a new access token from a refresh token',
  security: [],
  request: { body: { content: jsonContent(RefreshBody) } },
  responses: responses(z.object({ token: z.string() }), 'New access token'),
});
registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Revoke a refresh token',
  security: [],
  request: { body: { content: jsonContent(RefreshBody) } },
  responses: responses(z.object({ ok: z.boolean() })),
});
registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Current authenticated user',
  security: secured,
  responses: responses(UserSummary),
});

// ===========================================================================
// CARDS
// ===========================================================================
const idParam = z.object({ id: z.string() });
registry.registerPath({
  method: 'get',
  path: '/cards',
  tags: ['Cards'],
  summary: 'List all cards visible to the caller',
  security: secured,
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'get',
  path: '/cards/{id}',
  tags: ['Cards'],
  summary: 'Get one card',
  security: secured,
  request: { params: idParam },
  responses: responses(Json),
});
registry.registerPath({
  method: 'put',
  path: '/cards/{id}/stage',
  tags: ['Cards'],
  summary: 'Move a card to a new stage (writes audit + prev stage)',
  security: secured,
  request: { params: idParam, body: { content: jsonContent(cardStageSchema) } },
  responses: responses(Json, 'Updated card'),
});
registry.registerPath({
  method: 'patch',
  path: '/cards/{id}',
  tags: ['Cards'],
  summary: 'Patch arbitrary card fields',
  security: secured,
  request: { params: idParam, body: { content: jsonContent(CardPatchBody) } },
  responses: responses(Json, 'Updated card'),
});
registry.registerPath({
  method: 'post',
  path: '/cards/{id}/actions/{action}',
  tags: ['Cards'],
  summary:
    'Run a flow action (e.g. signContract → cascades cross-track cards transactionally)',
  security: secured,
  request: {
    params: z.object({
      id: z.string(),
      action: z
        .enum([
          'sendFollowUp',
          'signContract',
          'planWorkshopVisit',
          'generateInvoice',
          'sendDunning',
          'approvePeppol',
          'notifyPickup',
        ])
        .openapi({ description: 'Action name' }),
    }),
    body: { content: jsonContent(ActionStateBody) },
  },
  responses: responses(
    z.object({
      card: Json,
      cascades: JsonArray,
      createdCards: JsonArray,
    }),
    'Action result with cascade lines + created cards',
  ),
});

// ===========================================================================
// REPORTS
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/reports',
  tags: ['Reports'],
  summary: 'List generated reports',
  security: secured,
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'post',
  path: '/reports',
  tags: ['Reports'],
  summary: 'Generate a report (Anthropic if keyed, scripted fallback otherwise)',
  security: secured,
  request: { body: { content: jsonContent(specSchema) } },
  responses: responses(Json, 'Created report'),
});
registry.registerPath({
  method: 'get',
  path: '/reports/{id}',
  tags: ['Reports'],
  summary: 'Get one report',
  security: secured,
  request: { params: idParam },
  responses: responses(Json),
});
registry.registerPath({
  method: 'delete',
  path: '/reports/{id}',
  tags: ['Reports'],
  summary: 'Delete a report',
  security: secured,
  request: { params: idParam },
  responses: responses(z.object({ ok: z.boolean() })),
});

// ===========================================================================
// AGGREGATIONS
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/aggregations/track/{track}',
  tags: ['Aggregations'],
  summary: 'Aggregations for a single track',
  security: secured,
  request: { params: z.object({ track: z.string() }) },
  responses: responses(Json),
});
registry.registerPath({
  method: 'get',
  path: '/aggregations/dashboard',
  tags: ['Aggregations'],
  summary: 'Dashboard-level aggregations',
  security: secured,
  responses: responses(Json),
});

// ===========================================================================
// AUDIT
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/audit',
  tags: ['Audit'],
  summary: 'List audit entries',
  security: secured,
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'post',
  path: '/audit/{id}/revert',
  tags: ['Audit'],
  summary: 'Transactionally revert an audit entry (e.g. undo a cascade)',
  security: secured,
  request: { params: idParam },
  responses: responses(Json, 'Revert result'),
});

// ===========================================================================
// INTEGRATIONS
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/integrations',
  tags: ['Integrations'],
  summary: 'List integrations (Nango — simulated)',
  security: secured,
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'post',
  path: '/integrations',
  tags: ['Integrations'],
  summary: 'Add an integration',
  security: secured,
  request: { body: { content: jsonContent(integrationAddSchema) } },
  responses: responses(Json),
});

// ===========================================================================
// RECORDS  (server-side field-level RBAC demo endpoint)
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/records/{dataType}',
  tags: ['Records (RBAC)'],
  summary:
    'Get a sample record filtered by the caller’s effective field rules',
  security: secured,
  request: {
    params: z.object({ dataType: z.string() }),
    query: z.object({
      previewAs: z
        .string()
        .optional()
        .openapi({ description: 'Admin only: filter as this user id' }),
      role: z
        .string()
        .optional()
        .openapi({ description: 'Admin only: filter using this role id' }),
    }),
  },
  responses: responses(
    z.object({ dataType: z.string(), record: Json, previewAs: z.string().optional() }),
    'Filtered record',
  ),
});

// ===========================================================================
// ADMIN · STRUCTURE
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/admin/structure',
  tags: ['Admin · Structure'],
  summary: 'Org structure tree',
  security: secured,
  responses: responses(Json),
});
registry.registerPath({
  method: 'get',
  path: '/admin/structure/{id}/settings',
  tags: ['Admin · Structure'],
  summary: 'Settings for an org node',
  security: secured,
  request: { params: idParam },
  responses: responses(Json),
});
registry.registerPath({
  method: 'post',
  path: '/admin/structure/{parentId}/companies',
  tags: ['Admin · Structure'],
  summary: 'Add a company under a parent node',
  security: secured,
  request: {
    params: z.object({ parentId: z.string() }),
    body: { content: jsonContent(companySchema) },
  },
  responses: responses(Json),
});
registry.registerPath({
  method: 'patch',
  path: '/admin/structure/{id}',
  tags: ['Admin · Structure'],
  summary: 'Update an org node',
  security: secured,
  request: { params: idParam, body: { content: jsonContent(structurePatchSchema) } },
  responses: responses(Json),
});
registry.registerPath({
  method: 'get',
  path: '/admin/data-sharing',
  tags: ['Admin · Structure'],
  summary: 'List data-sharing rules',
  security: secured,
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'put',
  path: '/admin/data-sharing',
  tags: ['Admin · Structure'],
  summary: 'Replace data-sharing rules',
  security: secured,
  request: { body: { content: jsonContent(sharingSchema) } },
  responses: responses(JsonArray),
});

// ===========================================================================
// ADMIN · ROLES
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/admin/roles',
  tags: ['Admin · Roles'],
  summary: 'List roles',
  security: secured,
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'post',
  path: '/admin/roles',
  tags: ['Admin · Roles'],
  summary: 'Create a new (custom) role',
  security: secured,
  request: {
    body: {
      content: jsonContent(
        z.object({
          id: z.string().optional(),
          name: z.string(),
          desc: z.string().optional(),
          tracks: z.array(z.string()).optional(),
          edit: z.string().optional(),
          system: z.boolean().optional(),
        }).openapi('RoleCreateBody'),
      ),
    },
  },
  responses: responses(Json),
});
registry.registerPath({
  method: 'post',
  path: '/admin/roles/{id}/clone',
  tags: ['Admin · Roles'],
  summary: 'Clone a role and all its field rules',
  security: secured,
  request: {
    params: idParam,
    body: { content: jsonContent(z.object({ id: z.string().optional(), name: z.string().optional() }).openapi('RoleCloneBody')) },
  },
  responses: responses(Json),
});

// ===========================================================================
// ADMIN · USERS
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/admin/users',
  tags: ['Admin · Users'],
  summary: 'List users',
  security: secured,
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'post',
  path: '/admin/users',
  tags: ['Admin · Users'],
  summary: 'Create a user',
  security: secured,
  request: { body: { content: jsonContent(UserCreateBody) } },
  responses: responses(Json),
});
registry.registerPath({
  method: 'get',
  path: '/admin/users/{id}',
  tags: ['Admin · Users'],
  summary: 'Get one user',
  security: secured,
  request: { params: idParam },
  responses: responses(Json),
});
registry.registerPath({
  method: 'patch',
  path: '/admin/users/{id}',
  tags: ['Admin · Users'],
  summary: 'Update a user',
  security: secured,
  request: { params: idParam, body: { content: jsonContent(UserPatchBody) } },
  responses: responses(Json),
});
registry.registerPath({
  method: 'post',
  path: '/admin/users/{id}/scopes',
  tags: ['Admin · Users'],
  summary: 'Add a secondary scope to a user',
  security: secured,
  request: { params: idParam, body: { content: jsonContent(ScopeBody) } },
  responses: responses(Json),
});
registry.registerPath({
  method: 'delete',
  path: '/admin/users/{id}/scopes/{scopeId}',
  tags: ['Admin · Users'],
  summary: 'Remove a secondary scope',
  security: secured,
  request: { params: z.object({ id: z.string(), scopeId: z.string() }) },
  responses: responses(z.object({ ok: z.boolean() })),
});

// ===========================================================================
// ADMIN · FIELD RULES (RBAC)
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/admin/field-rules',
  tags: ['Admin · Field Rules'],
  summary: 'List field rules (filter by role/dataType/scope)',
  security: secured,
  request: {
    query: z.object({
      role: z.string().optional(),
      dataType: z.string().optional(),
      scope: z.enum(RULE_SCOPES).optional(),
    }),
  },
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'put',
  path: '/admin/field-rules',
  tags: ['Admin · Field Rules'],
  summary: 'Apply a bulk set of field-rule diffs (versioned)',
  security: secured,
  request: { body: { content: jsonContent(FieldRulesBulkBody) } },
  responses: responses(Json),
});
registry.registerPath({
  method: 'get',
  path: '/admin/rbac/versions',
  tags: ['Admin · Field Rules'],
  summary: 'List RBAC rule versions',
  security: secured,
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'post',
  path: '/admin/rbac/versions/{v}/revert',
  tags: ['Admin · Field Rules'],
  summary: 'Transactionally revert the field-rule set to a stored version',
  security: secured,
  request: {
    params: z.object({ v: z.string() }),
    body: { content: jsonContent(z.object({ actor: z.string().optional() }).openapi('RevertBody')) },
  },
  responses: responses(Json),
});

// ===========================================================================
// ADMIN · STAGE CONFIG
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/admin/stage-config',
  tags: ['Admin · Stage Config'],
  summary: 'Get stage config (optionally for one track)',
  security: secured,
  request: { query: z.object({ track: z.string().optional() }) },
  responses: responses(Json),
});
registry.registerPath({
  method: 'put',
  path: '/admin/stage-config/{track}',
  tags: ['Admin · Stage Config'],
  summary: 'Replace the ordered stage set for a track',
  security: secured,
  request: {
    params: z.object({ track: z.string() }),
    body: { content: jsonContent(StageConfigPutBody) },
  },
  responses: responses(Json),
});

// ===========================================================================
// ADMIN · TRIGGERS
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/admin/triggers',
  tags: ['Admin · Triggers'],
  summary: 'List cross-track triggers',
  security: secured,
  responses: responses(JsonArray),
});
registry.registerPath({
  method: 'post',
  path: '/admin/triggers',
  tags: ['Admin · Triggers'],
  summary: 'Create a cross-track trigger',
  security: secured,
  request: { body: { content: jsonContent(TriggerBody) } },
  responses: responses(Json),
});
registry.registerPath({
  method: 'delete',
  path: '/admin/triggers/{id}',
  tags: ['Admin · Triggers'],
  summary: 'Delete a trigger',
  security: secured,
  request: { params: idParam },
  responses: responses(z.object({ ok: z.boolean() })),
});

// ===========================================================================
// ME (dashboard + permissions)
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/me/dashboard',
  tags: ['Me'],
  summary: 'Current user’s saved dashboard',
  security: secured,
  responses: responses(Json),
});
registry.registerPath({
  method: 'put',
  path: '/me/dashboard',
  tags: ['Me'],
  summary: 'Save the current user’s dashboard layout',
  security: secured,
  request: { body: { content: jsonContent(dashboardPutSchema) } },
  responses: responses(Json),
});
registry.registerPath({
  method: 'get',
  path: '/me/permissions',
  tags: ['Me'],
  summary: 'Effective permissions for the current user',
  security: secured,
  responses: responses(Json),
});
const PrefsBody = z.object({
  enforceLocks: z.boolean(),
  peppol: z.boolean(),
  emailNotif: z.boolean(),
  slackNotif: z.boolean(),
  dailyDigest: z.boolean(),
  autoEscalate: z.boolean(),
}).partial().openapi('PrefsBody');
registry.registerPath({
  method: 'get',
  path: '/me/preferences',
  tags: ['Me'],
  summary: 'Current user’s settings toggles (defaults if never saved)',
  security: secured,
  responses: responses(PrefsBody),
});
registry.registerPath({
  method: 'put',
  path: '/me/preferences',
  tags: ['Me'],
  summary: 'Update the current user’s settings toggles',
  security: secured,
  request: { body: { content: jsonContent(PrefsBody) } },
  responses: responses(PrefsBody),
});

// ===========================================================================
// HEALTH (public)
// ===========================================================================
registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Liveness probe (unauthenticated)',
  security: [],
  responses: { 200: { description: 'OK', content: jsonContent(z.object({ ok: z.boolean() })) } },
});

// ---------------------------------------------------------------------------
// Build the document
// ---------------------------------------------------------------------------
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'DLPE Intelligence Layer API',
      version: '1.0.0',
      description:
        'Fleet-operations console API. All routes are JWT-secured except ' +
        '`/auth/login`, `/auth/refresh`, `/auth/logout` and `/health`. ' +
        'Use **Authorize** (top-right) with a token from `POST /auth/login`.',
    },
    servers: [{ url: '/api', description: 'Same-origin API root' }],
  });
}
