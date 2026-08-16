import { test, expect } from '@playwright/test';

test.describe('E2E Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Fail on any page errors
    page.on('pageerror', (exception) => {
      expect(exception.message).toBeNull();
    });

    // Fail on console errors, ignoring expected 401s on admin token failure and 404s for favicon or unhandled resources
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('status of 401') && !msg.text().includes('status of 404')) {
        expect(msg.text()).toBeNull();
      }
    });

    // Intercept YouTube calls
    await page.route('**/*youtube-nocookie.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>Mock YouTube Embed</body></html>',
      });
    });
  });

  test('Landing Page loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Les maths,petit sprint par petit sprint');
  });

  test('Programme Navigation works', async ({ page }) => {
    await page.goto('/');

    // Click button to view programme
    await page.locator('button:has-text("Voir tout le programme →")').click();

    // Verify programme page loaded
    await expect(page.locator('h1')).toContainText('Un programme organisé');

    // Click into a course
    const courseCard = page.locator('.course-card').first();
    await courseCard.click();

    // Verify course page loaded (by checking the course head h1, we don't know the exact title, so check visibility)
    await expect(page.locator('.course-head h1')).toBeVisible();
  });

  test('Revision Content displays properly', async ({ page }) => {
    await page.goto('/revision');

    // Check elements on revision page
    await expect(page.locator('span.eyebrow').first()).toContainText('Mémoire active');
    await expect(page.locator('.review-panel')).toBeVisible();
  });

  test('Admin Route is safe from unauthorized access', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('h1')).toContainText('Brancher la correction');

    // Fill the token with incorrect data
    await page.locator('input[placeholder="ADMIN_TOKEN"]').fill('wrong-token');

    // Click the status verification button
    await page.locator('button:has-text("Vérifier le statut")').click();

    // Admin message should appear with error context
    await expect(page.locator('.admin-message')).toBeVisible();
  });
});
