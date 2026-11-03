import { test, expect } from '@playwright/test';

test('home page shows the heading Solace Avenue', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Solace Avenue' })).toBeVisible();
});
