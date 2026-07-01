import { test, expect } from '@playwright/test';

// Overview (Phase 1): the scorecard row + track sections are driven by the
// tenant's tracks from GET /tracks — not a hardcoded four.
async function login(page, email = 'r.mertens@group.eu') {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByPlaceholder(/search vehicles/i)).toBeVisible({ timeout: 15000 });
}

test('scorecard row renders one card per tenant track', async ({ page }) => {
  await login(page);
  // dlpe-demo has four tracks → four scorecards.
  await expect(page.locator('.scorecard')).toHaveCount(4);
  await expect(page.locator('.scorecard .scName').first()).toBeVisible();
});

test('opening a scorecard reveals that track’s board', async ({ page }) => {
  await login(page);
  // Each scorecard is #scorecard-<trackKey>; its footer button opens the board.
  const sales = page.locator('#scorecard-sales');
  await expect(sales).toBeVisible();
  await sales.locator('.scViewBtn').click();
  await expect(page.locator('#track-sales')).toBeVisible({ timeout: 10000 });
});
