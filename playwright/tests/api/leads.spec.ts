import { test, expect, APIRequestContext } from '@playwright/test';
import { auth, LEADS_URL, uniquePerson } from '../../fixtures';

// Leads service (qa/LEADS_CODE_REVIEW.md). Tests tagged @defect assert the documented product rule and fail
// on the starter build because of the finding named in their annotation.

const review = (id: string) => ({ type: 'code-review', description: `${id} (qa/LEADS_CODE_REVIEW.md)` });

type Lead = { id: string; status: string; duplicateOf: string | null };

async function apply(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  const person = uniquePerson('Lead');
  return request.post(`${LEADS_URL}/leads`, {
    data: {
      ...person,
      city: 'Lagos',
      experienceYears: 1,
      hoursPerWeek: 5,
      source: 'playwright',
      consent: true,
      ...overrides,
    },
  });
}

async function newLead(request: APIRequestContext, overrides: Record<string, unknown> = {}): Promise<Lead> {
  const res = await apply(request, overrides);
  expect(res.status()).toBe(201);
  return res.json();
}

test.describe('applications', () => {
  test('a valid application is scored and stored', async ({ request }) => {
    // 3+ years (40) + 20 h (30) + Lagos (30) = 100
    const lead = await newLead(request, { experienceYears: 3, hoursPerWeek: 20 });
    expect(lead).toMatchObject({ status: 'screening_invite', duplicateOf: null });

    const stored = await request.get(`${LEADS_URL}/leads/${lead.id}`, { headers: auth.viewer });
    expect(await stored.json()).toMatchObject({ score: 100, status: 'screening_invite' });
  });

  test('an application without consent is rejected with 422', async ({ request }) => {
    const res = await apply(request, { consent: false });
    expect(res.status()).toBe(422);
    expect(JSON.stringify(await res.json())).toContain('consent');
  });

  test('the lead list needs a staff token', async ({ request }) => {
    expect((await request.get(`${LEADS_URL}/leads`)).status()).toBe(401);
  });

  test(
    'a score of exactly 70 gets a screening invite',
    { tag: '@defect', annotation: review('CR-03') },
    async ({ request }) => {
      // PRODUCT_NOTES §2: score >= 70 -> screening_invite. 3 years (40) + 15 h (20) + Ibadan (10) = 70.
      const lead = await newLead(request, { experienceYears: 3, hoursPerWeek: 15, city: 'Ibadan' });
      expect(lead.status).toBe('screening_invite');
    }
  );

  test(
    'the same email in different case is a duplicate',
    { tag: '@defect', annotation: review('CR-04') },
    async ({ request }) => {
      const person = uniquePerson('Dup');
      const first = await newLead(request, { ...person, email: person.email.toUpperCase() });
      const second = await newLead(request, { ...person, phone: `${person.phone}9` });
      expect(second).toMatchObject({ status: 'duplicate', duplicateOf: first.id });
    }
  );

  test(
    'the same phone written in local format is a duplicate',
    { tag: '@defect', annotation: review('CR-04') },
    async ({ request }) => {
      const a = uniquePerson('Phone');
      const first = await newLead(request, a);
      const local = `0${a.phone.slice(4)}`; // +234XXXXXXXXXX -> 0XXXXXXXXXX
      const second = await newLead(request, { ...uniquePerson('Phone'), phone: local });
      expect(second).toMatchObject({ status: 'duplicate', duplicateOf: first.id });
    }
  );

  test(
    'non-numeric experience is a 422 validation error, not a 500',
    { tag: '@defect', annotation: review('CR-05') },
    async ({ request }) => {
      const res = await apply(request, { experienceYears: 'three' });
      expect(res.status()).toBe(422);
    }
  );

  test(
    'negative experience and impossible hours are rejected',
    { tag: '@defect', annotation: review('CR-05') },
    async ({ request }) => {
      const res = await apply(request, { experienceYears: -2, hoursPerWeek: 500 });
      expect(res.status()).toBe(422);
    }
  );
});

test.describe('status changes', () => {
  test('an admin can move a lead to needs_review', async ({ request }) => {
    const lead = await newLead(request);
    const res = await request.patch(`${LEADS_URL}/leads/${lead.id}/status`, {
      headers: auth.admin,
      data: { status: 'needs_review' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('needs_review');
  });

  test(
    'a viewer cannot change a lead status',
    { tag: '@defect', annotation: review('CR-01') },
    async ({ request }) => {
      const lead = await newLead(request);
      const res = await request.patch(`${LEADS_URL}/leads/${lead.id}/status`, {
        headers: auth.viewer,
        data: { status: 'needs_review' },
      });
      expect.soft(res.status()).toBe(403);

      const stored = await request.get(`${LEADS_URL}/leads/${lead.id}`, { headers: auth.admin });
      expect((await stored.json()).status).toBe(lead.status);
    }
  );

  test(
    'no one can mark a lead active',
    { tag: '@defect', annotation: review('CR-02') },
    async ({ request }) => {
      // PRODUCT_NOTES §2: "The system never marks anyone hired, active or field ready."
      const lead = await newLead(request);
      const res = await request.patch(`${LEADS_URL}/leads/${lead.id}/status`, {
        headers: auth.admin,
        data: { status: 'active' },
      });
      expect(res.status()).toBe(422);
    }
  );
});

test.describe('template rendering', () => {
  test(
    'a template key cannot climb out of the templates directory',
    { tag: '@defect', annotation: review('CR-09') },
    async ({ request }) => {
      const res = await request.post(`${LEADS_URL}/templates/..%2Ftemplates%2Fsolace-intro/render`, {
        headers: auth.automation,
        data: { variables: {} },
      });
      expect(res.status()).toBe(404);
    }
  );

  test(
    'draft templates cannot be rendered for sending',
    { tag: '@defect', annotation: review('CR-10') },
    async ({ request }) => {
      const res = await request.post(`${LEADS_URL}/templates/old-promo-draft/render`, {
        headers: auth.automation,
        data: { variables: {} },
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  );
});
