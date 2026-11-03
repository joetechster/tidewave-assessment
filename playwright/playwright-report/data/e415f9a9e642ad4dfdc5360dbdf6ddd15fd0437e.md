# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api\leads.spec.ts >> applications >> a score of exactly 70 gets a screening invite
- Location: tests\api\leads.spec.ts:52:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "screening_invite"
Received: "needs_review"
```

# Test source

```ts
  1   | import { test, expect, APIRequestContext } from '@playwright/test';
  2   | import { auth, LEADS_URL, uniquePerson } from '../../fixtures';
  3   | 
  4   | // Leads service (qa/LEADS_CODE_REVIEW.md). Tests tagged @defect assert the documented product rule and fail
  5   | // on the starter build because of the finding named in their annotation.
  6   | 
  7   | const review = (id: string) => ({ type: 'code-review', description: `${id} (qa/LEADS_CODE_REVIEW.md)` });
  8   | 
  9   | type Lead = { id: string; status: string; duplicateOf: string | null };
  10  | 
  11  | async function apply(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  12  |   const person = uniquePerson('Lead');
  13  |   return request.post(`${LEADS_URL}/leads`, {
  14  |     data: {
  15  |       ...person,
  16  |       city: 'Lagos',
  17  |       experienceYears: 1,
  18  |       hoursPerWeek: 5,
  19  |       source: 'playwright',
  20  |       consent: true,
  21  |       ...overrides,
  22  |     },
  23  |   });
  24  | }
  25  | 
  26  | async function newLead(request: APIRequestContext, overrides: Record<string, unknown> = {}): Promise<Lead> {
  27  |   const res = await apply(request, overrides);
  28  |   expect(res.status()).toBe(201);
  29  |   return res.json();
  30  | }
  31  | 
  32  | test.describe('applications', () => {
  33  |   test('a valid application is scored and stored', async ({ request }) => {
  34  |     // 3+ years (40) + 20 h (30) + Lagos (30) = 100
  35  |     const lead = await newLead(request, { experienceYears: 3, hoursPerWeek: 20 });
  36  |     expect(lead).toMatchObject({ status: 'screening_invite', duplicateOf: null });
  37  | 
  38  |     const stored = await request.get(`${LEADS_URL}/leads/${lead.id}`, { headers: auth.viewer });
  39  |     expect(await stored.json()).toMatchObject({ score: 100, status: 'screening_invite' });
  40  |   });
  41  | 
  42  |   test('an application without consent is rejected with 422', async ({ request }) => {
  43  |     const res = await apply(request, { consent: false });
  44  |     expect(res.status()).toBe(422);
  45  |     expect(JSON.stringify(await res.json())).toContain('consent');
  46  |   });
  47  | 
  48  |   test('the lead list needs a staff token', async ({ request }) => {
  49  |     expect((await request.get(`${LEADS_URL}/leads`)).status()).toBe(401);
  50  |   });
  51  | 
  52  |   test(
  53  |     'a score of exactly 70 gets a screening invite',
  54  |     { tag: '@defect', annotation: review('CR-03') },
  55  |     async ({ request }) => {
  56  |       // PRODUCT_NOTES §2: score >= 70 -> screening_invite. 3 years (40) + 15 h (20) + Ibadan (10) = 70.
  57  |       const lead = await newLead(request, { experienceYears: 3, hoursPerWeek: 15, city: 'Ibadan' });
> 58  |       expect(lead.status).toBe('screening_invite');
      |                           ^ Error: expect(received).toBe(expected) // Object.is equality
  59  |     }
  60  |   );
  61  | 
  62  |   test(
  63  |     'the same email in different case is a duplicate',
  64  |     { tag: '@defect', annotation: review('CR-04') },
  65  |     async ({ request }) => {
  66  |       const person = uniquePerson('Dup');
  67  |       const first = await newLead(request, { ...person, email: person.email.toUpperCase() });
  68  |       const second = await newLead(request, { ...person, phone: `${person.phone}9` });
  69  |       expect(second).toMatchObject({ status: 'duplicate', duplicateOf: first.id });
  70  |     }
  71  |   );
  72  | 
  73  |   test(
  74  |     'the same phone written in local format is a duplicate',
  75  |     { tag: '@defect', annotation: review('CR-04') },
  76  |     async ({ request }) => {
  77  |       const a = uniquePerson('Phone');
  78  |       const first = await newLead(request, a);
  79  |       const local = `0${a.phone.slice(4)}`; // +234XXXXXXXXXX -> 0XXXXXXXXXX
  80  |       const second = await newLead(request, { ...uniquePerson('Phone'), phone: local });
  81  |       expect(second).toMatchObject({ status: 'duplicate', duplicateOf: first.id });
  82  |     }
  83  |   );
  84  | 
  85  |   test(
  86  |     'non-numeric experience is a 422 validation error, not a 500',
  87  |     { tag: '@defect', annotation: review('CR-05') },
  88  |     async ({ request }) => {
  89  |       const res = await apply(request, { experienceYears: 'three' });
  90  |       expect(res.status()).toBe(422);
  91  |     }
  92  |   );
  93  | 
  94  |   test(
  95  |     'negative experience and impossible hours are rejected',
  96  |     { tag: '@defect', annotation: review('CR-05') },
  97  |     async ({ request }) => {
  98  |       const res = await apply(request, { experienceYears: -2, hoursPerWeek: 500 });
  99  |       expect(res.status()).toBe(422);
  100 |     }
  101 |   );
  102 | });
  103 | 
  104 | test.describe('status changes', () => {
  105 |   test('an admin can move a lead to needs_review', async ({ request }) => {
  106 |     const lead = await newLead(request);
  107 |     const res = await request.patch(`${LEADS_URL}/leads/${lead.id}/status`, {
  108 |       headers: auth.admin,
  109 |       data: { status: 'needs_review' },
  110 |     });
  111 |     expect(res.status()).toBe(200);
  112 |     expect((await res.json()).status).toBe('needs_review');
  113 |   });
  114 | 
  115 |   test(
  116 |     'a viewer cannot change a lead status',
  117 |     { tag: '@defect', annotation: review('CR-01') },
  118 |     async ({ request }) => {
  119 |       const lead = await newLead(request);
  120 |       const res = await request.patch(`${LEADS_URL}/leads/${lead.id}/status`, {
  121 |         headers: auth.viewer,
  122 |         data: { status: 'needs_review' },
  123 |       });
  124 |       expect.soft(res.status()).toBe(403);
  125 | 
  126 |       const stored = await request.get(`${LEADS_URL}/leads/${lead.id}`, { headers: auth.admin });
  127 |       expect((await stored.json()).status).toBe(lead.status);
  128 |     }
  129 |   );
  130 | 
  131 |   test(
  132 |     'no one can mark a lead active',
  133 |     { tag: '@defect', annotation: review('CR-02') },
  134 |     async ({ request }) => {
  135 |       // PRODUCT_NOTES §2: "The system never marks anyone hired, active or field ready."
  136 |       const lead = await newLead(request);
  137 |       const res = await request.patch(`${LEADS_URL}/leads/${lead.id}/status`, {
  138 |         headers: auth.admin,
  139 |         data: { status: 'active' },
  140 |       });
  141 |       expect(res.status()).toBe(422);
  142 |     }
  143 |   );
  144 | });
  145 | 
  146 | test.describe('template rendering', () => {
  147 |   test(
  148 |     'a template key cannot climb out of the templates directory',
  149 |     { tag: '@defect', annotation: review('CR-09') },
  150 |     async ({ request }) => {
  151 |       const res = await request.post(`${LEADS_URL}/templates/..%2Ftemplates%2Fsolace-intro/render`, {
  152 |         headers: auth.automation,
  153 |         data: { variables: {} },
  154 |       });
  155 |       expect(res.status()).toBe(404);
  156 |     }
  157 |   );
  158 | 
```