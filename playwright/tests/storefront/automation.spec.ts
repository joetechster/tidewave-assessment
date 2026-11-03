import { test, expect, Page } from '@playwright/test';
import {
  auth,
  deleteMail,
  engineChaos,
  engineEvents,
  loginAs,
  mailpitChaos,
  mailSubjects,
  payWithCard,
  redeliver,
  resetAll,
  sendSignedEvent,
  startListenerBacking,
  uniquePerson,
} from '../../fixtures';

// Section B: the solace-events n8n workflow, driven by real engine events (resetAll points the engine at
// the published webhook). Confirmations go to ada's seeded address, ada.obi@example.test.
const ADA = 'to:ada.obi@example.test subject:"Backing is Confirmed"';
const CONFIRMED = 'Your Solace Avenue Backing is Confirmed';

test.beforeEach(async () => {
  await resetAll();
  await mailpitChaos(0);
  await deleteMail(ADA);
});

test.afterEach(async () => {
  await mailpitChaos(0);
});

/** ada backs at Listener level with a card that succeeds; returns the engine payment id. */
async function backAsAda(page: Page) {
  await loginAs(page, 'ada');
  const providerRef = await startListenerBacking(page);
  await payWithCard(page, '4242 4242 4242 4242');
  await page.waitForURL(/\/checkout\/return/);
  const payments = await (await page.request.get('/api/staff/payments', { headers: auth.admin })).json();
  return payments.find((p: { providerRef: string }) => p.providerRef === providerRef).id as string;
}

const confirmations = () => mailSubjects(ADA);

/** Wait long enough for any extra (duplicate) email to have arrived, then return the count. */
async function settledCount(ms = 4_000) {
  await new Promise((r) => setTimeout(r, ms));
  return (await confirmations()).length;
}

test.describe('backing confirmation email', () => {
  test('a confirmed backing gets exactly one email, even when the event is replayed', async ({ page }) => {
    const paymentId = await backAsAda(page);
    await expect.poll(confirmations, { timeout: 20_000 }).toEqual([CONFIRMED]);

    // Engine-side redelivery of the same event, and a new event id for the same payment.
    const event = (await engineEvents()).filter((e) => e.type === 'payment.updated').pop()!;
    await redeliver(event.id);
    const replay = await sendSignedEvent('solace-events', {
      id: `evt_replay_${Date.now()}`,
      type: 'payment.updated',
      data: { paymentId, status: 'succeeded' },
    });
    expect(replay.body).toMatchObject({ action: 'duplicate' });

    expect(await settledCount()).toBe(1);
  });

  test('an event that claims success for an unpaid payment sends nothing', async ({ page }) => {
    await loginAs(page, 'ada');
    const providerRef = await startListenerBacking(page);
    const payments = await (await page.request.get('/api/staff/payments', { headers: auth.admin })).json();
    const payment = payments.find((p: { providerRef: string }) => p.providerRef === providerRef);
    expect(payment.status).toBe('created');

    // Correctly signed, but the payload's "succeeded" is not what FakePay says.
    const res = await sendSignedEvent('solace-events', {
      id: `evt_forged_${Date.now()}`,
      type: 'payment.updated',
      data: { paymentId: payment.id, status: 'succeeded', amountMinor: 200000, currency: 'NGN' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ action: 'skipped' });
    expect(await settledCount(2_000)).toBe(0);
  });

  test('recovers when the engine automation API returns 503 twice', async ({ page }) => {
    // The workflow's "Verify Payment With Engine" call fails twice, then its retry succeeds.
    await engineChaos(503, 2);
    await backAsAda(page);
    await expect.poll(confirmations, { timeout: 20_000 }).toEqual([CONFIRMED]);
    expect(await settledCount()).toBe(1);
  });

  test('recovers through engine redelivery when 503s outlast the workflow retries', async ({ page }) => {
    test.setTimeout(90_000);
    // 5 tries in the first delivery all fail, so n8n answers 503 and nothing is claimed; the engine
    // redelivers after 5 s and that delivery gets through.
    await engineChaos(503, 6);
    await backAsAda(page);
    await expect.poll(confirmations, { timeout: 60_000, intervals: [2_000] }).toEqual([CONFIRMED]);
    expect(await settledCount()).toBe(1);
  });

  test('recovers when Mailpit refuses the message with 451', async ({ page }) => {
    test.setTimeout(90_000);
    await mailpitChaos(100);
    await backAsAda(page);

    // While Mailpit refuses, nothing is delivered; the SMTP node keeps retrying (5 tries, 5 s apart).
    await new Promise((r) => setTimeout(r, 6_000));
    expect(await confirmations()).toEqual([]);
    await mailpitChaos(0);

    await expect.poll(confirmations, { timeout: 30_000 }).toEqual([CONFIRMED]);
    // The engine also redelivered while the first run was still retrying; that run must not send again.
    expect(await settledCount(6_000)).toBe(1);
  });
});

test.describe('opt-in intro email', () => {
  async function optIn(page: Page, email: string, consent: boolean) {
    await page.goto('/campaigns/harmattan-sessions');
    const form = page.locator('form[action="/optin"]');
    await form.getByLabel('First name', { exact: true }).fill('Ife');
    await form.getByLabel('Email', { exact: true }).fill(email);
    await form.getByRole('checkbox').setChecked(consent);
    await form.getByRole('button', { name: 'Keep me posted' }).click();
    await expect(page).toHaveURL(/optin=1/);
  }

  test('an opt-in with consent gets one intro email, even if the visitor opts in twice', async ({ page }) => {
    const { email } = uniquePerson('Intro');
    await optIn(page, email, true);
    await expect.poll(() => mailSubjects(`to:${email}`), { timeout: 20_000 }).toEqual(['Welcome to Solace Avenue']);

    await optIn(page, email, true);
    await new Promise((r) => setTimeout(r, 4_000));
    expect(await mailSubjects(`to:${email}`)).toHaveLength(1);
  });

  test('an opt-in without consent gets no email', async ({ page }) => {
    const { email } = uniquePerson('NoConsent');
    await optIn(page, email, false);
    await expect
      .poll(async () => (await engineEvents()).filter((e) => e.type === 'optin.created').pop()?.lastStatus, { timeout: 15_000 })
      .toBe('200');
    expect(await mailSubjects(`to:${email}`)).toEqual([]);
  });
});
