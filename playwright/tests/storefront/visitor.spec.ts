import { test, expect } from '@playwright/test';
import { uniquePerson } from '../../fixtures';

test.describe('public visitor journey', () => {
  test('previews music on the artist page', async ({ page }) => {
    await page.goto('/artist/solace-avenue');
    const player = page.locator('[data-player]');
    const time = player.locator('.time');
    await expect(time).toHaveText('0:00 / 0:30');

    await player.getByRole('button', { name: 'Play preview' }).click();
    await expect(player.getByRole('button', { name: 'Pause preview' })).toBeVisible();
    // The preview ticks every 250 ms; wait for the clock to move rather than sleeping.
    await expect(time).not.toHaveText('0:00 / 0:30');

    await player.getByRole('button', { name: 'Pause preview' }).click();
    await expect(player.getByRole('button', { name: 'Play preview' })).toBeVisible();
  });

  test('opts in for campaign updates with consent ticked by the visitor', async ({ page }) => {
    const person = uniquePerson('Optin');
    await page.goto('/campaigns/harmattan-sessions');

    const form = page.locator('form[action="/optin"]');
    const consent = form.getByRole('checkbox');
    await expect(consent).not.toBeChecked();

    await form.getByLabel('First name', { exact: true }).fill(person.firstName);
    await form.getByLabel('Email', { exact: true }).fill(person.email);
    await consent.check();
    await form.getByRole('button', { name: 'Keep me posted' }).click();

    await expect(page).toHaveURL(/\/campaigns\/harmattan-sessions\?optin=1/);
    await expect(page.getByText('You are on the list. Check your inbox.')).toBeVisible();
    await expect(page.locator('.err')).toHaveCount(0);
  });

  test('rejects an opt-in without a first name', async ({ page }) => {
    await page.goto('/artist/solace-avenue');
    const form = page.locator('form[action="/optin"]');
    await form.getByLabel('Email', { exact: true }).fill(uniquePerson('NoName').email);
    await form.getByRole('button', { name: 'Get updates' }).click();

    await expect(page).toHaveURL(/error=/);
    await expect(page.locator('#updates .err')).toHaveText(
      'Please enter your first name and a valid email'
    );
  });

  test(
    'artist page marketing consent box is unticked by default',
    {
      tag: '@defect',
      annotation: { type: 'ticket', description: 'TW-001 (tickets/TW-001-artist-page-consent-prechecked.md)' },
    },
    async ({ page }) => {
      // PRODUCT_NOTES §3: "The marketing consent box is unticked by default."
      await page.goto('/artist/solace-avenue');
      const consent = page.locator('form[action="/optin"]').getByRole('checkbox');
      await expect(consent).not.toBeChecked();
    }
  );
});
