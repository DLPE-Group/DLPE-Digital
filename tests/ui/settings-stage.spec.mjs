import { test, expect } from '@playwright/test';

// Settings → Stage configuration: the editor is driven by the tenant's tracks
// (GET /tracks) and persists to the bare-key StageConfig. Renaming a stage and
// saving must succeed (the flow the client reported broken, now regression-locked).
async function login(page, email = 'r.mertens@group.eu') {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByPlaceholder(/search vehicles/i)).toBeVisible({ timeout: 15000 });
}

const navTo = (page, label) =>
  page.locator('.sideMenu').getByText(label, { exact: true }).first().click();

test('renaming a stage and saving succeeds', async ({ page }) => {
  await login(page);
  await navTo(page, 'Settings');
  await expect(page.getByText('Stage configuration')).toBeVisible({ timeout: 15000 });

  // Rename the first stage's label, then Save config → the "Saved" flag appears.
  const firstLabel = page.locator('.stageEditRow input[type="text"]').first();
  await expect(firstLabel).toBeVisible();
  await firstLabel.fill('Renamed Stage QA');
  await page.getByRole('button', { name: /Save config/i }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10000 });
});
