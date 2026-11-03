# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api\leads.spec.ts >> template rendering >> draft templates cannot be rendered for sending
- Location: tests\api\leads.spec.ts:159:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 400
Received:    200
```

# Test source

```ts
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
  159 |   test(
  160 |     'draft templates cannot be rendered for sending',
  161 |     { tag: '@defect', annotation: review('CR-10') },
  162 |     async ({ request }) => {
  163 |       const res = await request.post(`${LEADS_URL}/templates/old-promo-draft/render`, {
  164 |         headers: auth.automation,
  165 |         data: { variables: {} },
  166 |       });
> 167 |       expect(res.status()).toBeGreaterThanOrEqual(400);
      |                            ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  168 |     }
  169 |   );
  170 | });
  171 | 
```