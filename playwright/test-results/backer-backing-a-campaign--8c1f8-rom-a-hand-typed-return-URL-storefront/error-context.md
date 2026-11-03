# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: storefront\backer.spec.ts >> backing a campaign >> an unpaid backing is not credited from a hand-typed return URL
- Location: tests\storefront\backer.spec.ts:79:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByText(/You're in/)
Expected: 0
Received: 1
Timeout:  10000ms

Call log:
  - Expect "soft toHaveCount" getByText(/You're in/) with timeout 10000ms
  - waiting for getByText(/You're in/)
    23 × locator resolved to 1 element
       - unexpected value "1"

```

```
Error: expect(received).not.toBe(expected) // Object.is equality

Expected: not "succeeded"
```

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByText(/Confirmed backing: ₦2,000\.00/)
Expected: 0
Received: 1
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" getByText(/Confirmed backing: ₦2,000\.00/) with timeout 10000ms
  - waiting for getByText(/Confirmed backing: ₦2,000\.00/)
    23 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [active] [ref=f6e1]:
  - banner [ref=f6e2]:
    - generic [ref=f6e3]:
      - link "TidewaveMusic" [ref=f6e4] [cursor=pointer]:
        - /url: /
      - navigation [ref=f6e5]:
        - link "Solace Avenue" [ref=f6e6] [cursor=pointer]:
          - /url: /artist/solace-avenue
        - link "Harmattan Sessions" [ref=f6e7] [cursor=pointer]:
          - /url: /campaigns/harmattan-sessions
        - link "Street Team" [ref=f6e8] [cursor=pointer]:
          - /url: /street-team
        - link "Ada" [ref=f6e9] [cursor=pointer]:
          - /url: /me
        - button "Sign out" [ref=f6e11] [cursor=pointer]
  - main [ref=f6e12]:
    - heading "Hello, Ada" [level=1] [ref=f6e13]
    - generic [ref=f6e14]:
      - generic [ref=f6e15]:
        - heading "Harmattan Sessions" [level=2] [ref=f6e16]
        - paragraph [ref=f6e17]:
          - text: "Level:"
          - strong [ref=f6e18]: Listener
        - paragraph [ref=f6e19]: "Confirmed backing: ₦2,000.00"
        - paragraph [ref=f6e20]:
          - link "Back again" [ref=f6e21] [cursor=pointer]:
            - /url: /checkout?campaign=harmattan-sessions
      - generic [ref=f6e22]:
        - heading "Your account" [level=2] [ref=f6e23]
        - list [ref=f6e24]:
          - listitem [ref=f6e25]:
            - link "My backing and receipts" [ref=f6e26] [cursor=pointer]:
              - /url: /me/contributions
          - listitem [ref=f6e27]:
            - link "Invite friends" [ref=f6e28] [cursor=pointer]:
              - /url: /me/referrals
          - listitem [ref=f6e29]:
            - link "Campaign page" [ref=f6e30] [cursor=pointer]:
              - /url: /campaigns/harmattan-sessions
        - paragraph [ref=f6e31]: Signed in as ada · ada.obi@example.test · pays in NGN
  - contentinfo [ref=f6e32]:
    - generic [ref=f6e33]: Tidewave Music is a fictional company made for a test. Backing a campaign is voluntary. It is not employment and not an investment.
```

# Test source

```ts
  4   | // Each test starts from seed data so ada is a new backer with nothing confirmed.
  5   | test.beforeEach(async () => {
  6   |   await resetAll();
  7   | });
  8   | 
  9   | test.describe('persona account', () => {
  10  |   test('ada signs in and sees her account on /me', async ({ page }) => {
  11  |     await loginAs(page, 'ada');
  12  |     await expect(page.getByRole('heading', { name: 'Hello, Ada' })).toBeVisible();
  13  |     await expect(page.getByText('Signed in as ada')).toContainText('pays in NGN');
  14  |     await expect(page.getByRole('link', { name: 'My backing and receipts' })).toBeVisible();
  15  |   });
  16  | 
  17  |   test('kofi sees that he pays in GHS', async ({ page }) => {
  18  |     await loginAs(page, 'kofi');
  19  |     await expect(page.getByText('Signed in as kofi')).toContainText('pays in GHS');
  20  |   });
  21  | 
  22  |   test('wrong password is rejected and stays on the login page', async ({ page }) => {
  23  |     await page.goto('/login');
  24  |     await page.getByLabel('Username').fill('ada');
  25  |     await page.getByLabel('Password').fill('not-the-password');
  26  |     await page.getByRole('button', { name: 'Sign in' }).click();
  27  | 
  28  |     await expect(page).toHaveURL(/\/login/);
  29  |     await expect(page.getByRole('heading', { name: /Hello/ })).toHaveCount(0);
  30  |   });
  31  | 
  32  |   test('/me requires a signed-in participant', async ({ page }) => {
  33  |     await page.goto('/me');
  34  |     await expect(page).toHaveURL(/\/login/);
  35  |   });
  36  | });
  37  | 
  38  | test.describe('backing a campaign', () => {
  39  |   test('ada backs at Listener level with a card that succeeds', async ({ page }) => {
  40  |     await loginAs(page, 'ada');
  41  |     await startListenerBacking(page);
  42  |     await payWithCard(page, '4242 4242 4242 4242');
  43  | 
  44  |     await page.waitForURL(/\/checkout\/return/);
  45  |     await expect(page.getByText(/You're in/)).toBeVisible();
  46  | 
  47  |     // FakePay webhooks land ~1 s after the redirect; poll /me instead of sleeping.
  48  |     await expect(async () => {
  49  |       await page.goto('/me');
  50  |       await expect(page.getByText('Confirmed backing: ₦2,000.00')).toBeVisible({ timeout: 1_000 });
  51  |     }).toPass({ timeout: 15_000 });
  52  |     await expect(page.getByText('Level: Listener')).toBeVisible();
  53  |   });
  54  | 
  55  |   test('a declined card is not counted', async ({ page }) => {
  56  |     await loginAs(page, 'ada');
  57  |     await startListenerBacking(page);
  58  |     await payWithCard(page, '4000 0000 0000 0002');
  59  | 
  60  |     await page.waitForURL(/\/checkout\/return/);
  61  |     await expect(page.getByText('Payment not completed')).toBeVisible();
  62  |     await expect(page.getByText(/You're in/)).toHaveCount(0);
  63  | 
  64  |     await page.goto('/me');
  65  |     await expect(page.getByText(/Confirmed backing: ₦2,000\.00/)).toHaveCount(0);
  66  |   });
  67  | 
  68  |   test('an amount below the ₦1,000 minimum is not quoted', async ({ page }) => {
  69  |     await loginAs(page, 'ada');
  70  |     await page.goto('/checkout?campaign=harmattan-sessions');
  71  |     await page.getByLabel('Amount (NGN)').fill('500');
  72  |     await page.getByRole('checkbox', { name: /backing is voluntary/ }).check();
  73  |     await page.getByRole('button', { name: 'Review backing' }).click();
  74  | 
  75  |     await expect(page).toHaveURL(/\/checkout\?.*error=/);
  76  |     await expect(page.getByRole('heading', { name: 'Review your backing' })).toHaveCount(0);
  77  |   });
  78  | 
  79  |   test(
  80  |     'an unpaid backing is not credited from a hand-typed return URL',
  81  |     {
  82  |       tag: '@defect',
  83  |       annotation: { type: 'ticket', description: 'TW-004 (tickets/TW-004-backing-credited-from-return-url.md)' },
  84  |     },
  85  |     async ({ page }) => {
  86  |       await loginAs(page, 'ada');
  87  |       const providerRef = await startListenerBacking(page);
  88  | 
  89  |       // No card is entered. Find the merchant payment behind this FakePay session.
  90  |       const res = await page.request.get('/api/staff/payments', { headers: auth.admin });
  91  |       const payment = (await res.json()).find((p: { providerRef: string }) => p.providerRef === providerRef);
  92  |       expect(payment.status).toBe('created');
  93  | 
  94  |       await page.goto(`/checkout/return?payment=${payment.id}&status=success`);
  95  |       // PR14: "You're in" appears only after FakePay confirms.
  96  |       await expect.soft(page.getByText(/You're in/)).toHaveCount(0);
  97  | 
  98  |       const after = await page.request.get('/api/staff/payments', { headers: auth.admin });
  99  |       const stored = (await after.json()).find((p: { id: string }) => p.id === payment.id);
  100 |       // PR4: only a FakePay `succeeded` counts; FakePay was never paid.
  101 |       expect.soft(stored.status).not.toBe('succeeded');
  102 | 
  103 |       await page.goto('/me');
> 104 |       await expect(page.getByText(/Confirmed backing: ₦2,000\.00/)).toHaveCount(0);
      |                                                                     ^ Error: expect(locator).toHaveCount(expected) failed
  105 |     }
  106 |   );
  107 | });
  108 | 
```