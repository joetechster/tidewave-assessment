import { test, expect, Page } from '@playwright/test';
import { auth, loginAs, resetAll } from '../../fixtures';

// Each test starts from seed data so ada is a new backer with nothing confirmed.
test.beforeEach(async () => {
  await resetAll();
});

/** From the campaign checkout, quote the Listener level and land on the FakePay page. */
async function startListenerBacking(page: Page) {
  await page.goto('/checkout?campaign=harmattan-sessions');
  await page.getByRole('button', { name: /Become a Listener/ }).click();
  await page.getByRole('checkbox', { name: /backing is voluntary/ }).check();
  await page.getByRole('button', { name: 'Review backing' }).click();

  await expect(page.getByRole('heading', { name: 'Review your backing' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Fee \(2\.5%\)/ })).toContainText('₦100.00');
  await expect(page.getByRole('row', { name: /Total to pay/ })).toContainText('₦2,100.00');
  await page.getByRole('button', { name: 'Pay with FakePay' }).click();

  await page.waitForURL(/localhost:7090\/pay\/fp_/);
  return new URL(page.url()).pathname.split('/').pop()!;
}

async function payWithCard(page: Page, card: string) {
  await page.getByLabel('Card number').fill(card);
  await page.getByLabel('Expiry').fill('12/30');
  await page.getByLabel('CVC').fill('123');
  await page.getByRole('button', { name: /^Pay / }).click();
}

test.describe('persona account', () => {
  test('ada signs in and sees her account on /me', async ({ page }) => {
    await loginAs(page, 'ada');
    await expect(page.getByRole('heading', { name: 'Hello, Ada' })).toBeVisible();
    await expect(page.getByText('Signed in as ada')).toContainText('pays in NGN');
    await expect(page.getByRole('link', { name: 'My backing and receipts' })).toBeVisible();
  });

  test('kofi sees that he pays in GHS', async ({ page }) => {
    await loginAs(page, 'kofi');
    await expect(page.getByText('Signed in as kofi')).toContainText('pays in GHS');
  });

  test('wrong password is rejected and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('ada');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Hello/ })).toHaveCount(0);
  });

  test('/me requires a signed-in participant', async ({ page }) => {
    await page.goto('/me');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('backing a campaign', () => {
  test('ada backs at Listener level with a card that succeeds', async ({ page }) => {
    await loginAs(page, 'ada');
    await startListenerBacking(page);
    await payWithCard(page, '4242 4242 4242 4242');

    await page.waitForURL(/\/checkout\/return/);
    await expect(page.getByText(/You're in/)).toBeVisible();

    // FakePay webhooks land ~1 s after the redirect; poll /me instead of sleeping.
    await expect(async () => {
      await page.goto('/me');
      await expect(page.getByText('Confirmed backing: ₦2,000.00')).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.getByText('Level: Listener')).toBeVisible();
  });

  test('a declined card is not counted', async ({ page }) => {
    await loginAs(page, 'ada');
    await startListenerBacking(page);
    await payWithCard(page, '4000 0000 0000 0002');

    await page.waitForURL(/\/checkout\/return/);
    await expect(page.getByText('Payment not completed')).toBeVisible();
    await expect(page.getByText(/You're in/)).toHaveCount(0);

    await page.goto('/me');
    await expect(page.getByText(/Confirmed backing: ₦2,000\.00/)).toHaveCount(0);
  });

  test('an amount below the ₦1,000 minimum is not quoted', async ({ page }) => {
    await loginAs(page, 'ada');
    await page.goto('/checkout?campaign=harmattan-sessions');
    await page.getByLabel('Amount (NGN)').fill('500');
    await page.getByRole('checkbox', { name: /backing is voluntary/ }).check();
    await page.getByRole('button', { name: 'Review backing' }).click();

    await expect(page).toHaveURL(/\/checkout\?.*error=/);
    await expect(page.getByRole('heading', { name: 'Review your backing' })).toHaveCount(0);
  });

  test(
    'an unpaid backing is not credited from a hand-typed return URL',
    {
      tag: '@defect',
      annotation: { type: 'ticket', description: 'TW-004 (tickets/TW-004-backing-credited-from-return-url.md)' },
    },
    async ({ page }) => {
      await loginAs(page, 'ada');
      const providerRef = await startListenerBacking(page);

      // No card is entered. Find the merchant payment behind this FakePay session.
      const res = await page.request.get('/api/staff/payments', { headers: auth.admin });
      const payment = (await res.json()).find((p: { providerRef: string }) => p.providerRef === providerRef);
      expect(payment.status).toBe('created');

      await page.goto(`/checkout/return?payment=${payment.id}&status=success`);
      // PR14: "You're in" appears only after FakePay confirms.
      await expect.soft(page.getByText(/You're in/)).toHaveCount(0);

      const after = await page.request.get('/api/staff/payments', { headers: auth.admin });
      const stored = (await after.json()).find((p: { id: string }) => p.id === payment.id);
      // PR4: only a FakePay `succeeded` counts; FakePay was never paid.
      expect.soft(stored.status).not.toBe('succeeded');

      await page.goto('/me');
      await expect(page.getByText(/Confirmed backing: ₦2,000\.00/)).toHaveCount(0);
    }
  );
});
