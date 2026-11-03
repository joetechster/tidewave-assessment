import { test, expect } from '@playwright/test';
import { auth, LEADS_URL, mailSubjects, N8N_URL, sendSignedEvent, uniquePerson } from '../../fixtures';

// Section B: n8n workflows called directly, the way the leads service and ops console call them.

const settle = (ms = 4_000) => new Promise((r) => setTimeout(r, ms));

async function applyAsLead(request: import('@playwright/test').APIRequestContext, overrides: Record<string, unknown>) {
  const person = uniquePerson('Street');
  const res = await request.post(`${LEADS_URL}/leads`, {
    data: { ...person, city: 'Lagos', source: 'playwright', consent: true, ...overrides },
  });
  expect(res.status()).toBe(201);
  return { ...person, ...(await res.json()) } as { email: string; id: string; status: string };
}

test.describe('webhook signatures', () => {
  for (const path of ['solace-events', 'street-team-lead']) {
    test(`${path} rejects events without a valid signature`, async ({ request }) => {
      const event = { id: `evt_unsigned_${Date.now()}`, type: 'optin.created', data: {} };
      const unsigned = await request.post(`${N8N_URL}/webhook/${path}`, { data: event });
      expect(unsigned.status()).toBe(401);

      const wrongSecret = await sendSignedEvent(path, event, 'not-the-secret');
      expect(wrongSecret.status).toBe(401);
    });
  }
});

test.describe('street-team-lead workflow', () => {
  test('a screening invite gets one follow-up email that never says "active"', async ({ request }) => {
    // 3+ years (40) + 20 h (30) + Lagos (30) = 100, which the starter workflow emailed as an "active rep".
    const lead = await applyAsLead(request, { experienceYears: 3, hoursPerWeek: 20 });
    expect(lead.status).toBe('screening_invite');

    await expect.poll(() => mailSubjects(`to:${lead.email}`), { timeout: 20_000 }).toEqual([
      'Tidewave Street Team - Next Steps',
    ]);
    const search = await request.get('http://localhost:7025/api/v1/search', { params: { query: `to:${lead.email}` } });
    const id = (await search.json()).messages[0].ID;
    const text = ((await (await request.get(`http://localhost:7025/api/v1/message/${id}`)).json()).Text as string).toLowerCase();
    for (const banned of ['active', 'hired', 'field ready']) expect(text).not.toContain(banned);

    const activity = await (await request.get(`${LEADS_URL}/leads/${lead.id}/activity`, { headers: auth.admin })).json();
    expect(activity.map((a: { type: string }) => a.type)).toContain('email_sent');
    const stored = await (await request.get(`${LEADS_URL}/leads/${lead.id}`, { headers: auth.admin })).json();
    expect(stored.status).toBe('screening_invite');

    // A replayed lead.created for the same lead does not send again.
    const replay = await sendSignedEvent('street-team-lead', {
      id: `evt_replay_${Date.now()}`,
      type: 'lead.created',
      data: { leadId: lead.id, status: 'screening_invite', email: lead.email },
    });
    expect(replay.body).toMatchObject({ action: 'duplicate' });
    await settle();
    expect(await mailSubjects(`to:${lead.email}`)).toHaveLength(1);
  });

  test('leads below the screening threshold get no email', async ({ request }) => {
    // 0 years (0) + 15 h (20) + Lagos (30) = 50.
    const lead = await applyAsLead(request, { experienceYears: 0, hoursPerWeek: 15 });
    expect(lead.status).toBe('needs_review');
    await settle();
    expect(await mailSubjects(`to:${lead.email}`)).toEqual([]);
  });

  test('an event whose payload claims screening_invite is checked against the stored lead', async ({ request }) => {
    const lead = await applyAsLead(request, { experienceYears: 0, hoursPerWeek: 0 });
    expect(lead.status).toBe('not_now');
    const res = await sendSignedEvent('street-team-lead', {
      id: `evt_forged_${Date.now()}`,
      type: 'lead.created',
      data: { leadId: lead.id, status: 'screening_invite', email: lead.email },
    });
    expect(res.body).toMatchObject({ action: 'skipped' });
    await settle(2_000);
    expect(await mailSubjects(`to:${lead.email}`)).toEqual([]);
  });
});

test.describe('staff-test-run workflow', () => {
  const RUN = `${N8N_URL}/webhook/staff-test-run`;

  test('refuses draft templates even when called directly', async ({ request }) => {
    const res = await request.post(RUN, { data: { templateKey: 'old-promo-draft', variables: { firstName: 'Bayo' } } });
    expect(res.status()).toBe(400);
    expect((await res.json()).ok).toBe(false);
  });

  test('refuses a run with a required variable missing', async ({ request }) => {
    const res = await request.post(RUN, { data: { templateKey: 'solace-intro', variables: { firstName: 'Ada' } } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Campaign URL');
  });
});
