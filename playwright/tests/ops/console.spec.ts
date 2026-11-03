import { test, expect } from '@playwright/test';
import { auth, ENGINE_URL, opsLogin, resetAll } from '../../fixtures';

test.beforeAll(async ({ request }) => {
  test.setTimeout(120_000);
  await resetAll();
  // `next dev` compiles each route on first hit (10-20 s cold). Warm them up front
  // so test assertions measure the console, not the compiler.
  for (const route of ['/login', '/leads', '/leads/lead_seed_10', '/payments']) {
    await request.get(route, { timeout: 90_000 });
  }
});

test.describe('Admin', () => {
  test.beforeEach(async ({ page }) => {
    await opsLogin(page, 'Admin');
  });

  test('browses leads and searches by name', async ({ page }) => {
    await expect(page.getByLabel('Role indicator')).toHaveText('Role: Admin');
    await expect(page.getByRole('heading', { name: 'Street Team Leads' })).toBeVisible();
    await expect(page.getByText(/Page 1 of \d+ \(\d+ total leads\)/)).toBeVisible();

    const rows = page.locator('table.data-table tbody tr');
    await expect(rows.nth(1)).toBeVisible();

    await page.getByPlaceholder('Search leads by name, email, or city...').fill('Folake');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('folake.coker@mail.test');
  });

  test('opens a lead and sees its details and activity', async ({ page }) => {
    await page.getByPlaceholder('Search leads by name, email, or city...').fill('Folake');
    await page.locator('table.data-table tbody tr').first().click();

    await expect(page).toHaveURL(/\/leads\/lead_seed_10$/);
    await expect(page.getByRole('heading', { name: 'Folake Coker' })).toBeVisible();
    await expect(page.getByText('folake.coker@mail.test')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
    await expect(page.getByRole('row', { name: /application_created/ })).toBeVisible();
  });

  test('views payments and can refund succeeded ones', async ({ page }) => {
    await page.getByRole('link', { name: 'Payments' }).click();
    await page.waitForURL('**/payments');
    await expect(page.getByRole('heading', { name: 'Backing Payments' })).toBeVisible();

    const succeeded = page.locator('tbody tr', { has: page.locator('.badge', { hasText: /^succeeded$/ }) });
    await expect(succeeded.first()).toBeVisible();
    await expect(succeeded.first().getByRole('button', { name: 'Refund' })).toBeEnabled();
    await expect(page.getByText('Admin only')).toHaveCount(0);
  });
});

test.describe('Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await opsLogin(page, 'Viewer');
  });

  test('can browse leads and payments read-only', async ({ page }) => {
    await expect(page.getByLabel('Role indicator')).toHaveText('Role: Viewer');
    await expect(page.locator('table.data-table tbody tr').nth(1)).toBeVisible();

    await page.getByRole('link', { name: 'Payments' }).click();
    await page.waitForURL('**/payments');
    await expect(page.getByRole('heading', { name: 'Backing Payments' })).toBeVisible();
    await expect(page.getByText('Admin only').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refund' })).toHaveCount(0);
  });

  test('cannot trigger a refund through the console API (PR13)', async ({ page }) => {
    const payments = await (await page.request.get('/api/payments')).json();
    const target = payments.find((p: { status: string }) => p.status === 'succeeded');
    expect(target, 'seed data has a succeeded payment').toBeTruthy();

    // The hidden button is not the control: call the route the button would call.
    const res = await page.request.post('/api/refunds', { data: { paymentId: target.id } });
    expect(res.status()).toBe(403);

    const after = await page.request.get(`${ENGINE_URL}/api/staff/payments`, { headers: auth.admin });
    const stored = (await after.json()).find((p: { id: string }) => p.id === target.id);
    expect(stored.status).toBe('succeeded');
  });
});

test('signed-out requests to console APIs are rejected', async ({ request }) => {
  expect((await request.get('/api/leads')).status()).toBe(401);
  expect((await request.get('/api/payments')).status()).toBe(401);
});
