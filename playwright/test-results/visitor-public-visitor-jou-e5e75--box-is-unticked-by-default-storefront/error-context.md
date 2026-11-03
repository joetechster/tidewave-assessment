# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: storefront\visitor.spec.ts >> public visitor journey >> artist page marketing consent box is unticked by default
- Location: tests\storefront\visitor.spec.ts:50:7

# Error details

```
Error: expect(locator).not.toBeChecked() failed

Locator:  locator('form[action="/optin"]').getByRole('checkbox')
Expected: not checked
Received: checked
Timeout:  10000ms

Call log:
  - Expect "not toBeChecked" locator('form[action="/optin"]').getByRole('checkbox') with timeout 10000ms
  - waiting for locator('form[action="/optin"]').getByRole('checkbox')
    23 × locator resolved to <input checked value="yes" name="consent" type="checkbox"/>
       - unexpected value "checked"

```

```yaml
- checkbox [checked]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { uniquePerson } from '../../fixtures';
  3  | 
  4  | test.describe('public visitor journey', () => {
  5  |   test('previews music on the artist page', async ({ page }) => {
  6  |     await page.goto('/artist/solace-avenue');
  7  |     const player = page.locator('[data-player]');
  8  |     const time = player.locator('.time');
  9  |     await expect(time).toHaveText('0:00 / 0:30');
  10 | 
  11 |     await player.getByRole('button', { name: 'Play preview' }).click();
  12 |     await expect(player.getByRole('button', { name: 'Pause preview' })).toBeVisible();
  13 |     // The preview ticks every 250 ms; wait for the clock to move rather than sleeping.
  14 |     await expect(time).not.toHaveText('0:00 / 0:30');
  15 | 
  16 |     await player.getByRole('button', { name: 'Pause preview' }).click();
  17 |     await expect(player.getByRole('button', { name: 'Play preview' })).toBeVisible();
  18 |   });
  19 | 
  20 |   test('opts in for campaign updates with consent ticked by the visitor', async ({ page }) => {
  21 |     const person = uniquePerson('Optin');
  22 |     await page.goto('/campaigns/harmattan-sessions');
  23 | 
  24 |     const form = page.locator('form[action="/optin"]');
  25 |     const consent = form.getByRole('checkbox');
  26 |     await expect(consent).not.toBeChecked();
  27 | 
  28 |     await form.getByLabel('First name', { exact: true }).fill(person.firstName);
  29 |     await form.getByLabel('Email', { exact: true }).fill(person.email);
  30 |     await consent.check();
  31 |     await form.getByRole('button', { name: 'Keep me posted' }).click();
  32 | 
  33 |     await expect(page).toHaveURL(/\/campaigns\/harmattan-sessions\?optin=1/);
  34 |     await expect(page.getByText('You are on the list. Check your inbox.')).toBeVisible();
  35 |     await expect(page.locator('.err')).toHaveCount(0);
  36 |   });
  37 | 
  38 |   test('rejects an opt-in without a first name', async ({ page }) => {
  39 |     await page.goto('/artist/solace-avenue');
  40 |     const form = page.locator('form[action="/optin"]');
  41 |     await form.getByLabel('Email', { exact: true }).fill(uniquePerson('NoName').email);
  42 |     await form.getByRole('button', { name: 'Get updates' }).click();
  43 | 
  44 |     await expect(page).toHaveURL(/error=/);
  45 |     await expect(page.locator('#updates .err')).toHaveText(
  46 |       'Please enter your first name and a valid email'
  47 |     );
  48 |   });
  49 | 
  50 |   test(
  51 |     'artist page marketing consent box is unticked by default',
  52 |     {
  53 |       tag: '@defect',
  54 |       annotation: { type: 'ticket', description: 'TW-001 (tickets/TW-001-artist-page-consent-prechecked.md)' },
  55 |     },
  56 |     async ({ page }) => {
  57 |       // PRODUCT_NOTES §3: "The marketing consent box is unticked by default."
  58 |       await page.goto('/artist/solace-avenue');
  59 |       const consent = page.locator('form[action="/optin"]').getByRole('checkbox');
> 60 |       await expect(consent).not.toBeChecked();
     |                                 ^ Error: expect(locator).not.toBeChecked() failed
  61 |     }
  62 |   );
  63 | });
  64 | 
```