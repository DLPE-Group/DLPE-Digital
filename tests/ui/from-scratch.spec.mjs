import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';

/*
  From-scratch journey (the whole generic platform, end to end, through the UI):

    1. A platform admin provisions a NEW company from the "blank" blueprint
       (0 tracks / 0 entity-types) and sets an admin password so that admin can
       log in immediately.
    2. That brand-new admin logs in to the empty workspace.
    3. They build a basic data model in the UI — a track + a pipeline entity type.
    4. They add two stages to the track (Settings → Stage configuration).
    5. They create an entity (card) and drag it from the first stage to the
       second — proving the tenant they built from nothing actually works.

  Everything runs against the real API + RLS + test DB (tests/serve-test.mjs).
  The "blank" blueprint is a real seeded catalogue template, so no fixture
  blueprint is created here — this test exercises the shipped artifact.
*/

const SLUG = 'scratch-e2e';
const COMPANY = 'Scratch E2E Co';
const ADMIN_EMAIL = 'scratch-admin@scratch.test';
const ADMIN_PW = 'scratch1234';
// Globally-unique keys (TrackDef.key / EntityType.key are unique across tenants).
const TRACK_KEY = 'scratchflow';
const TRACK_LABEL = 'Deliveries';
const TYPE_KEY = 'scratchjob';
const TYPE_LABEL = 'Delivery job';
const STAGE_ONE = 'Booked';
const STAGE_TWO = 'Delivered';
const CUSTOMER = 'Scratch Customer A';

async function cleanup() {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  try {
    const t = await prisma.tenant.findUnique({ where: { slug: SLUG } });
    if (t) {
      const tenantId = t.id;
      // FK-safe teardown, mirroring setup-wizard.spec.mjs.
      await prisma.subscription.deleteMany({ where: { tenantId } });
      await prisma.auditEntry.deleteMany({ where: { tenantId } });
      await prisma.entity.deleteMany({ where: { tenantId } });
      await prisma.userScope.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.fieldRule.deleteMany({ where: { tenantId } });
      await prisma.stageDef.deleteMany({ where: { tenantId } });
      await prisma.stageConfig.deleteMany({ where: { tenantId } });
      await prisma.fieldDef.deleteMany({ where: { tenantId } });
      await prisma.entityType.deleteMany({ where: { tenantId } });
      await prisma.trackDef.deleteMany({ where: { tenantId } });
      await prisma.crossTrigger.deleteMany({ where: { tenantId } });
      await prisma.role.deleteMany({ where: { tenantId } });
      await prisma.orgNode.deleteMany({ where: { tenantId } });
      await prisma.provisioningRun.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

const navTo = (page, label) =>
  page.locator('.sideMenu').getByText(label, { exact: true }).first().click();

async function loginPlatformAdmin(page) {
  await page.goto('/');
  await page.locator('input[type="email"]').fill('r.mertens@group.eu');
  await page.locator('input[type="password"]').fill('demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByPlaceholder(/search vehicles/i)).toBeVisible({ timeout: 15000 });
}

async function loginNewAdmin(page) {
  // Drop the platform-admin session, then sign in as the freshly provisioned admin.
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PW);
  await page.getByRole('button', { name: /sign in/i }).click();
  // The empty workspace still gives a group-admin the Data model nav item.
  await expect(page.locator('.sideMenu').getByText('Data model', { exact: true }))
    .toBeVisible({ timeout: 15000 });
}

// Native HTML5 drag-and-drop with a shared DataTransfer. Playwright's mouse-based
// dragTo does NOT drive HTML5 dnd; the board reads dataTransfer.getData('text/plain'),
// which the real onDragStart populates on our shared transfer object.
async function dragCardToColumn(page, cardName, columnLabel) {
  await page.evaluate(({ cardName, columnLabel }) => {
    const card = [...document.querySelectorAll('.boardCard')]
      .find((c) => c.querySelector('.bcName')?.textContent?.includes(cardName));
    const col = [...document.querySelectorAll('.boardCol')]
      .find((c) => c.querySelector('.colName')?.textContent?.trim() === columnLabel);
    if (!card) throw new Error(`board card "${cardName}" not found`);
    if (!col) throw new Error(`board column "${columnLabel}" not found`);
    const dt = new DataTransfer();
    const fire = (el, type) =>
      el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    fire(card, 'dragstart');
    fire(col, 'dragover');
    fire(col, 'drop');
    fire(card, 'dragend');
  }, { cardName, columnLabel });
}

test('build a tenant from the blank blueprint and move an entity between stages', async ({ page }) => {
  test.setTimeout(90000);

  // ---- 1. Provision a new company from the blank blueprint (wizard) ----
  await loginPlatformAdmin(page);
  await navTo(page, 'Control plane');
  await expect(page.getByRole('heading', { name: 'Control plane' })).toBeVisible({ timeout: 10000 });

  await page.locator('[data-testid=wiz-bp]').selectOption('blank');
  await page.locator('[data-testid=wiz-next]').click();

  await page.locator('[data-testid=wiz-input-slug]').fill(SLUG);
  await page.locator('[data-testid=wiz-input-customerName]').fill(COMPANY);
  await page.locator('[data-testid=wiz-input-region]').fill('eu');
  await page.locator('[data-testid=wiz-next]').click();

  await page.locator('[data-testid=wiz-admin-email]').fill(ADMIN_EMAIL);
  await page.locator('[data-testid=wiz-admin-password]').fill(ADMIN_PW);
  await page.locator('[data-testid=wiz-next]').click();

  await expect(page.locator('[data-testid=wiz-summary]')).toBeVisible({ timeout: 10000 });
  // A blank blueprint provisions zero tracks / entity-types.
  await expect(page.locator('[data-testid=wiz-summary]')).toContainText('0 tracks');
  await page.locator('[data-testid=wiz-provision]').click();
  await expect(page.locator('[data-testid=wiz-done]')).toBeVisible({ timeout: 20000 });

  // ---- 2. Log in as the brand-new admin ----
  await loginNewAdmin(page);

  // ---- 3. Build a basic data model: a track + a pipeline entity type ----
  await navTo(page, 'Data model');
  await expect(page.getByRole('heading', { name: 'Data model' })).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: /New track/i }).click();
  await page.getByPlaceholder('key (e.g. insurance)').fill(TRACK_KEY);
  await page.getByPlaceholder('Label').fill(TRACK_LABEL);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(TRACK_KEY, { exact: true })).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: /New entity type/i }).click();
  await page.getByPlaceholder('key (e.g. claim)').fill(TYPE_KEY);
  await page.getByPlaceholder('Label').fill(TYPE_LABEL);
  // kind defaults to "pipeline"; the track select defaults to the only track.
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(TYPE_KEY, { exact: true })).toBeVisible({ timeout: 10000 });

  // ---- 4. Add two stages to the track (Settings → Stage configuration) ----
  await navTo(page, 'Settings');
  await expect(page.getByText('Stage configuration')).toBeVisible({ timeout: 15000 });
  // Select the new track's tab (the only one for this tenant).
  await page.locator('.editorTrackTabs .filterChip', { hasText: TRACK_LABEL }).click();

  const addStage = page.getByRole('button', { name: /Add stage/i });
  await addStage.click();
  await addStage.click();
  const labels = page.locator('.stageEditRow input[type="text"]');
  await expect(labels).toHaveCount(2);
  await labels.nth(0).fill(STAGE_ONE);
  await labels.nth(1).fill(STAGE_TWO);
  // Make the 2nd stage an entry stage too (no lock) so the move is unconditional.
  await page.locator('.stageEditRow').nth(1).locator('select').selectOption({ index: 0 });

  await page.getByRole('button', { name: /Save config/i }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10000 });

  // The App fetched /stages once at mount (before these stages existed). Reload so
  // the board picks up the tenant's newly-authored stages.
  await page.reload();
  await expect(page.locator('.sideMenu').getByText(TRACK_LABEL, { exact: true }))
    .toBeVisible({ timeout: 15000 });

  // ---- 5. Create an entity and move it from Booked → Delivered ----
  // Card creation uses window.prompt (title, then value) — answer both dialogs.
  page.on('dialog', async (d) => {
    const msg = d.message();
    if (/title|customer name/i.test(msg)) await d.accept(CUSTOMER);
    else if (/value/i.test(msg)) await d.accept('50000');
    else await d.accept();
  });

  await navTo(page, 'Overview');
  const scorecard = page.locator(`#scorecard-${TRACK_KEY}`);
  await expect(scorecard).toBeVisible({ timeout: 10000 });

  // Expand the track's pipeline section, then create an item inside it.
  const trackSection = page.locator(`#track-${TRACK_KEY}`);
  const ensureOpen = async () => {
    if (!(await trackSection.count())) {
      await scorecard.locator('.scViewBtn').click();
      await expect(trackSection).toBeVisible({ timeout: 10000 });
    }
  };
  await ensureOpen();
  await trackSection.getByRole('button', { name: /New item/i }).click();
  // Creation is confirmed by the scorecard's count (visible regardless of expand state).
  await expect(scorecard).toContainText(/1\s+item/i, { timeout: 10000 });

  await ensureOpen();
  await page.getByTitle('Board view').click();
  const bookedCol = page.locator('.boardCol', { has: page.locator('.colName', { hasText: STAGE_ONE }) });
  const deliveredCol = page.locator('.boardCol', { has: page.locator('.colName', { hasText: STAGE_TWO }) });
  await expect(bookedCol.locator('.bcName', { hasText: CUSTOMER })).toBeVisible();

  // Drag Booked → Delivered and wait for the server to persist the move.
  const movePut = page.waitForResponse(
    (r) => /\/cards\/.*\/stage/.test(r.url()) && r.request().method() === 'PUT' && r.ok(),
    { timeout: 10000 },
  );
  await dragCardToColumn(page, CUSTOMER, STAGE_TWO);
  await movePut;

  // The entity now lives in the second stage — the from-scratch tenant works.
  await expect(deliveredCol.locator('.bcName', { hasText: CUSTOMER })).toBeVisible({ timeout: 10000 });
  await expect(bookedCol.locator('.bcName', { hasText: CUSTOMER })).toHaveCount(0);
});
