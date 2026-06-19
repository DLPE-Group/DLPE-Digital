import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { get, post, patch, token, TEST_DB_URL } from '../helpers.mjs';

const ADMIN = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
const E2E_BP_KEY = 'cap-wiz-e2e';
const E2E_SLUG = 'wiz-e2e-1';

async function login(page, email = 'r.mertens@group.eu') {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  // app shell is up once the header search is present
  await expect(page.getByPlaceholder(/search vehicles/i)).toBeVisible({ timeout: 15000 });
}

const navTo = (page, label) =>
  page.locator('.sideMenu').getByText(label, { exact: true }).first().click();

async function cleanup() {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  try {
    // FK-safe teardown of any tenant from a prior run, keyed by slug
    const t = await prisma.tenant.findUnique({ where: { slug: E2E_SLUG } });
    if (t) {
      const tid = t.id;
      await prisma.subscription.deleteMany({ where: { tenantId: tid } });
      await prisma.userScope.deleteMany({ where: { tenantId: tid } });
      await prisma.user.deleteMany({ where: { tenantId: tid } });
      await prisma.fieldRule.deleteMany({ where: { tenantId: tid } });
      await prisma.stageDef.deleteMany({ where: { tenantId: tid } });
      await prisma.stageConfig.deleteMany({ where: { tenantId: tid } });
      await prisma.fieldDef.deleteMany({ where: { tenantId: tid } });
      await prisma.entityType.deleteMany({ where: { tenantId: tid } });
      await prisma.trackDef.deleteMany({ where: { tenantId: tid } });
      await prisma.crossTrigger.deleteMany({ where: { tenantId: tid } });
      await prisma.role.deleteMany({ where: { tenantId: tid } });
      await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
      await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
      await prisma.tenant.delete({ where: { id: tid } });
    }
    await prisma.blueprint.deleteMany({ where: { key: E2E_BP_KEY } });
  } finally { await prisma.$disconnect(); }
}

test.beforeAll(async () => {
  await cleanup();
  // Build a CONFIG-ONLY published blueprint from the demo spec: keep inputs/structure, strip seed + users.
  const demo = (await get('/platform/blueprints', ADMIN())).body.find((b) => b.key === 'dlpe-demo');
  const spec = { ...demo.spec };
  delete spec.seed;
  delete spec.users;
  const imp = await post('/platform/blueprints/import', { key: E2E_BP_KEY, name: 'Wizard E2E Template', spec }, ADMIN());
  const bpId = imp.body.id;
  await patch(`/platform/blueprints/${bpId}`, { status: 'PUBLISHED' }, ADMIN());
});

test.afterAll(cleanup);

test('setup wizard: provision a new tenant end-to-end', async ({ page }) => {
  await login(page);
  await navTo(page, 'Control plane');

  // Heading is visible
  await expect(page.getByRole('heading', { name: 'Control plane' })).toBeVisible({ timeout: 10000 });

  // Step 0 — Template: select the E2E blueprint
  await page.locator('[data-testid=wiz-bp]').selectOption(E2E_BP_KEY);
  await page.locator('[data-testid=wiz-next]').click();

  // Step 1 — Customer: fill the inputs (slug, customerName, region)
  await page.locator('[data-testid=wiz-input-slug]').fill(E2E_SLUG);
  await page.locator('[data-testid=wiz-input-customerName]').fill('Wizard E2E Co');
  await page.locator('[data-testid=wiz-input-region]').fill('eu');
  await page.locator('[data-testid=wiz-next]').click();

  // Step 2 — Admin & plan: set admin email (unique, avoids collision) and plan
  await page.locator('[data-testid=wiz-admin-email]').fill('wiz-e2e@wiz.test');
  await page.locator('[data-testid=wiz-plan]').selectOption('pro');
  await page.locator('[data-testid=wiz-next]').click();

  // Step 3 — Review: wiz-summary visible + slug "available" pill
  await expect(page.locator('[data-testid=wiz-summary]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid=wiz-review]')).toContainText(E2E_SLUG);
  await expect(page.locator('[data-testid=wiz-review]')).toContainText('available');

  // Provision!
  await page.locator('[data-testid=wiz-provision]').click();

  // Step 4 — Done
  await expect(page.locator('[data-testid=wiz-done]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid=wiz-link]')).toBeVisible();
});
