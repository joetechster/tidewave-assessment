import { test, expect, APIRequestContext } from '@playwright/test';

// Section D: email templates rendered by the leads service (TEMPLATES_DIR is the repo's templates/).
const LEADS = 'http://localhost:7081';
const N8N_TEST_RUN = 'http://localhost:7678/webhook/staff-test-run';
const MAILPIT = 'http://localhost:7025';
const STAFF = { Authorization: 'Bearer tw_staff_viewer_81d4e0' };

async function render(request: APIRequestContext, key: string, variables: Record<string, unknown> = {}, isTest = false) {
  const res = await request.post(`${LEADS}/templates/${key}/render`, {
    headers: STAFF,
    data: { variables, test: isTest },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as { subject: string; html: string; text: string };
}

// Visible copy only: no <head>/CSS, tags or entities.
function visibleText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

test.describe('template variable handling', () => {
  for (const key of ['street-team-prospect', 'solace-intro']) {
    test(`${key}: missing variables fall back instead of rendering "undefined"`, async ({ request }) => {
      const { html, text } = await render(request, key);
      expect(html).not.toContain('undefined');
      expect(text).toMatch(/(Hello|Hi) there,/);
      expect(html).toMatch(/href="http:\/\/localhost:7080\/[^"]+"/);
      expect(html).toMatch(/<a [^>]*href="mailto:unsubscribe@tidewave\.test[^"]*"[^>]*>\s*Unsubscribe\s*<\/a>/);
    });
  }

  test('values are HTML-escaped', async ({ request }) => {
    const { html } = await render(request, 'street-team-prospect', { firstName: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src&#x3D;x');
  });

  test('unsafe URL schemes are dropped and the default link is used', async ({ request }) => {
    const { html } = await render(request, 'solace-intro', { campaignUrl: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="http://localhost:7080/campaigns/harmattan-sessions"');
  });

  test('test renders get a [TEST] subject and a clean plain-text part', async ({ request }) => {
    const { subject, text } = await render(request, 'solace-intro', { firstName: 'Ada' }, true);
    expect(subject).toBe('[TEST] Welcome to Solace Avenue');
    expect(text).toContain('Hi Ada,');
    expect(text).not.toContain('@media');
  });

  test('draft templates are listed as draft', async ({ request }) => {
    const res = await request.get(`${LEADS}/templates`, { headers: STAFF });
    const templates = (await res.json()) as { key: string; status: string }[];
    expect(templates.find((t) => t.key === 'old-promo-draft')?.status).toBe('draft');
    expect(templates.find((t) => t.key === 'street-team-prospect')?.status).toBe('approved');
    expect(templates.find((t) => t.key === 'solace-intro')?.status).toBe('approved');
  });
});

test.describe('email briefs (docs/EMAIL_BRIEFS.md)', () => {
  test('street-team-prospect: must-include items present, must-not-say items absent', async ({ request }) => {
    const { html } = await render(request, 'street-team-prospect', {
      firstName: 'Kemi',
      nextStepText: 'Please complete your screening interview booking.',
      screeningUrl: 'http://localhost:7080/street-team/screening',
    });
    expect(html).toContain('name="viewport"');
    expect(html).toContain('Next step for your Tidewave Street Team application'); // preheader
    expect(html).toContain('Hello Kemi,');
    expect(html).toContain('Please complete your screening interview booking.');
    expect(html).toMatch(/<a [^>]*href="http:\/\/localhost:7080\/street-team\/screening"[^>]*>\s*Book your screening call/);
    expect(html).toContain('not an offer of employment or a binding engagement');

    const text = visibleText(html);
    for (const banned of ['hired', 'active', 'field ready', 'salary', 'wage', 'you will be accepted', 'guaranteed']) {
      expect(text, `must not say "${banned}"`).not.toContain(banned);
    }
  });

  test('solace-intro: must-include items present, must-not-say items absent', async ({ request }) => {
    const { html } = await render(request, 'solace-intro', {
      firstName: 'Ada',
      campaignUrl: 'http://localhost:7080/campaigns/harmattan-sessions',
      unsubscribeUrl: 'http://localhost:7080/u/abc',
    });
    expect(html).toContain('name="viewport"');
    expect(html).toContain('Meet the Harmattan Sessions'); // preheader
    expect(html).toContain('Hi Ada,');
    expect(html).toMatch(/<a [^>]*href="http:\/\/localhost:7080\/campaigns\/harmattan-sessions"[^>]*>\s*Explore the Harmattan Sessions/);
    expect(html).toContain('entirely voluntary');
    expect(html).toContain('not an investment, not a loan, and not employment');
    expect(html).toMatch(/<a [^>]*href="http:\/\/localhost:7080\/u\/abc"[^>]*>\s*Unsubscribe\s*<\/a>/);

    const text = visibleText(html);
    // The campaign page has no audio, so the email must not promise previews.
    expect(text).not.toContain('listen to previews');
    for (const banned of ['profit', 'royalt', 'equity', 'interest', 'guarantee', 'hurry', 'last chance', 'limited time', "don't miss"]) {
      expect(text, `must not say "${banned}"`).not.toContain(banned);
    }
  });
});

test('staff-test-run workflow ignores a supplied recipient and only sends to staff-test@tidewave.test', async ({ request }) => {
  const marker = `Override${Date.now()}`;
  const res = await request.post(N8N_TEST_RUN, {
    data: {
      templateKey: 'solace-intro',
      variables: {
        firstName: marker,
        campaignUrl: 'http://localhost:7080/campaigns/harmattan-sessions',
        email: 'someone-else@tidewave.test',
      },
    },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, to: 'staff-test@tidewave.test' });

  let recipients: string[][] = [];
  await expect
    .poll(async () => {
      const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: marker } });
      const body = (await search.json()) as { messages: { To: { Address: string }[] }[] };
      recipients = body.messages.map((m) => m.To.map((t) => t.Address));
      return recipients.length;
    }, { timeout: 15_000 })
    .toBe(1);
  expect(recipients[0]).toEqual(['staff-test@tidewave.test']);
});
