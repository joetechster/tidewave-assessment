import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { opsLogin } from '../../fixtures';

// Section D: staff test screen at /messages/test and mobile rendering of the candidate emails.
const LEADS = 'http://localhost:7081';
const MAILPIT = 'http://localhost:7025';
const STAFF = { Authorization: 'Bearer tw_staff_viewer_81d4e0' };

async function mailpitRecipients(request: APIRequestContext, marker: string): Promise<string[][]> {
  const res = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: marker } });
  const body = (await res.json()) as { messages: { To: { Address: string }[] }[] };
  return body.messages.map((m) => m.To.map((t) => t.Address));
}

async function openTestScreen(page: Page) {
  await opsLogin(page, 'Admin');
  await page.goto('/messages/test');
  await expect(page.getByLabel('Template')).toBeVisible();
}

test.describe('email templates at 375px', () => {
  for (const [key, cta] of [
    ['street-team-prospect', 'Book your screening call'],
    ['solace-intro', 'Explore the Harmattan Sessions'],
  ] as const) {
    test(`${key} fits a 375px screen without horizontal scrolling`, async ({ page, request }) => {
      const res = await request.post(`${LEADS}/templates/${key}/render`, { headers: STAFF, data: { variables: {} } });
      const { html } = await res.json();

      await page.setViewportSize({ width: 375, height: 812 });
      await page.setContent(html);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(375);

      const button = page.getByRole('link', { name: cta });
      await expect(button).toBeVisible();
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      expect(box.height).toBeGreaterThanOrEqual(44); // comfortable tap target

      const bodyFontPx = await page
        .locator('td.content')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(bodyFontPx).toBeGreaterThanOrEqual(16);
      await expect(page.getByRole('link', { name: 'Unsubscribe' })).toBeVisible();

      await page.screenshot({ path: test.info().outputPath(`${key}-375.png`), fullPage: true });
    });
  }
});

test.describe('/messages/test staff screen', () => {
  test('lists only approved templates and builds fields from template variables', async ({ page }) => {
    await openTestScreen(page);

    const options = await page.getByLabel('Template').locator('option').allTextContents();
    expect(options).toEqual(
      expect.arrayContaining(['Street Team Prospect Next Step', 'Solace Avenue Campaign Intro'])
    );
    expect(options.join('|')).not.toMatch(/draft/i);

    await page.getByLabel('Template').selectOption('street-team-prospect');
    const firstName = page.getByLabel('First Name');
    await expect(firstName).toHaveAttribute('placeholder', 'e.g. Kemi');
    await expect(firstName).toHaveAttribute('aria-required', 'true');
    await expect(page.getByLabel('Next Step Text')).toHaveAttribute('aria-required', 'true');
    await expect(page.getByLabel('Screening URL')).toHaveAttribute('aria-required', 'true');
    await expect(page.getByLabel('Unsubscribe Link')).toHaveAttribute('aria-required', 'false');
    await expect(page.locator('label[for="var-unsubscribeUrl"]')).toContainText('(optional)');
  });

  test('shows a live preview in a sandboxed iframe', async ({ page }) => {
    await openTestScreen(page);
    await page.getByLabel('Template').selectOption('street-team-prospect');

    const frame = page.getByTitle('Email preview');
    await expect(frame).toHaveAttribute('sandbox', '');
    await expect(frame).toHaveAttribute('srcdoc', /Hello there,/);
    await expect(page.getByTestId('preview-subject')).toHaveText('[TEST] Tidewave Street Team - Next Steps');

    await page.getByLabel('First Name').fill('Kemi');
    await expect(frame).toHaveAttribute('srcdoc', /Hello Kemi,/);
    await expect(page.frameLocator('iframe[title="Email preview"]').getByText('Hello Kemi,')).toBeVisible();

    await page.getByRole('button', { name: 'Mobile (375px)' }).click();
    await expect(frame).toHaveCSS('width', '375px');
  });

  test('blocks sending when required fields are empty', async ({ page }) => {
    await openTestScreen(page);
    await page.getByLabel('Template').selectOption('solace-intro');
    await page.getByLabel('First Name').fill('Ada');

    const testRun = page.waitForRequest('**/api/messages/test-run', { timeout: 1500 }).catch(() => null);
    await page.getByRole('button', { name: 'Send TEST run' }).click();

    await expect(page.getByTestId('test-run-notification')).toHaveText('Not sent. Please fill in: Campaign URL.');
    await expect(page.getByTestId('test-run-notification')).toHaveAttribute('role', 'alert');
    await expect(page.getByText('Campaign URL is required.')).toBeVisible();
    expect(await testRun).toBeNull();
  });

  test('sends exactly one TEST email to staff-test@tidewave.test, even on double-click', async ({ page, request }) => {
    const marker = `Pw${Date.now()}`;
    await openTestScreen(page);
    await page.getByLabel('Template').selectOption('street-team-prospect');
    await page.getByRole('button', { name: 'Fill with examples' }).click();
    await page.getByLabel('First Name').fill(marker);

    await page.getByRole('button', { name: 'Send TEST run' }).dblclick();

    await expect(page.getByTestId('test-run-notification')).toHaveText(
      'Sent. "[TEST] Tidewave Street Team - Next Steps" was delivered to staff-test@tidewave.test.',
      { timeout: 20_000 } // n8n render + SMTP, plus first-hit compile in next dev
    );
    await expect.poll(() => mailpitRecipients(request, marker), { timeout: 15_000 }).toHaveLength(1);
    // Give a duplicate time to arrive before asserting there is none.
    await page.waitForTimeout(3000);
    expect(await mailpitRecipients(request, marker)).toEqual([['staff-test@tidewave.test']]);
  });

  test('a previous result is cleared when the form is edited', async ({ page }) => {
    await openTestScreen(page);
    await page.getByLabel('Template').selectOption('solace-intro');
    await page.getByRole('button', { name: 'Send TEST run' }).click();
    await expect(page.getByTestId('test-run-notification')).toBeVisible();

    await page.getByLabel('First Name').fill('Ada');
    await expect(page.getByTestId('test-run-notification')).toHaveCount(0);
  });

  test('server rejects draft templates and missing required variables', async ({ request }) => {
    const headers = { Cookie: 'staff_role=Admin' };
    const draft = await request.post('/api/messages/test-run', {
      headers,
      data: { templateKey: 'old-promo-draft', variables: { firstName: 'Bayo' } },
    });
    expect(draft.status()).toBe(400);
    expect((await draft.json()).error).toMatch(/Draft templates cannot be test-sent/);

    const missing = await request.post('/api/messages/test-run', {
      headers,
      data: { templateKey: 'solace-intro', variables: { firstName: 'Ada' } },
    });
    expect(missing.status()).toBe(400);
    expect((await missing.json()).error).toBe('Please fill in: Campaign URL');

    const anonymous = await request.post('/api/messages/test-run', {
      data: { templateKey: 'solace-intro', variables: {} },
    });
    expect(anonymous.status()).toBe(401);
  });
});
