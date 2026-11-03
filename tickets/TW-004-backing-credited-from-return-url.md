# TW-004: Unpaid backing is credited and shown "You're in" from a hand-typed return URL

**Area**: Engine  
**Severity**: Critical  
**Environment**: Starter build, Persona: ada  
**Retest Status**: Open  

---

## Summary
The checkout return page `/checkout/return?payment=<id>&status=success` marks the payment `succeeded`
and writes a ledger credit based only on the `status` query string. A logged-in participant can start a
backing, skip paying on FakePay, open that URL by hand, and receive the full backing credit and level.
FakePay still reports the payment as `created` (never paid).

## Steps to Reproduce
1. Run `node tools/tw.mjs reset`. Log in to `http://localhost:7080` as `ada` / `listen123`.
2. Open Harmattan Sessions → "Back this campaign" → "Become a Listener - ₦2,000.00", tick the
   acknowledgement, "Review backing", then "Pay with FakePay".
3. On the FakePay page (`/pay/fp_...`) do **not** enter a card. Note the merchant payment id
   (`pay_...`, shown in the FakePay dashboard or `engine.payments`).
4. In the address bar open `http://localhost:7080/checkout/return?payment=<pay_id>&status=success`.
5. As `qa_reader`: `select status from engine.payments where id = '<pay_id>';` and
   `select kind, kobo, source from engine.ledger where payment_id = '<pay_id>';`
6. Check FakePay: `GET http://localhost:7090/v1/payments/<fp_ref>` with
   `Authorization: Bearer fp_sk_test_tidewave`.

## Expected Behavior
- A backing counts toward a level only when FakePay confirms it (`succeeded`) (PRODUCT_NOTES PR4).
- The "You're in" message appears only after confirmation (PR14).
- The return URL is a browser redirect whose query string the user controls, so it can show a
  "processing / waiting for confirmation" page, but it must not change payment status or the ledger.

## Actual Behavior
For `pay_ab5ca49a4a7557b639` / `fp_66ff01ac3d9098f54a` (receipt 1008), with no card ever submitted:

| | Before forged return | After forged return |
|---|---|---|
| `engine.payments.status` | `created` | **`succeeded`** (`last_sequence` 0) |
| `engine.ledger` | 0 rows | **credit 200000 kobo, `source = return_url`** (id 9) |
| `engine.outbox` | - | **`payment.updated` `status: succeeded`** queued (`evt_64d92ee6c94fc44a4c`) |
| FakePay `/v1/payments/fp_66ff01ac3d9098f54a` | `created` | `created` |
| Page shown | FakePay card form | **"You're in! … Level unlocked: Listener"** |

## Evidence
- Request / Response IDs:
  - `POST /checkout/pay` 303 `req_f340c90ad87af3c3ca` → `GET /pay/fp_66ff01ac3d9098f54a` 200 `req_765d9f4803d90462c4`
  - No `POST /pay/fp_66ff01ac3d9098f54a` and no `/webhooks/fakepay` call for this ref
  - `GET /checkout/return?payment=pay_ab5ca49a4a7557b639&status=success` 200 `req_717dac551b1427073b` (14:32:55Z)
- Logs or console output:
  - Before: [`evidence/qa/F-04b-before.txt`](../evidence/qa/F-04b-before.txt)
  - After: [`evidence/qa/F-04b-after-forged-return.txt`](../evidence/qa/F-04b-after-forged-return.txt)
  - Original observation on a paid backing: [`evidence/qa/F-04-credit-from-return-url.txt`](../evidence/qa/F-04-credit-from-return-url.txt)
- Screenshot / trace references:
  - "You're in!" for the unpaid payment: [`evidence/qa/F-04b-youre-in-unpaid.jpg`](../evidence/qa/F-04b-youre-in-unpaid.jpg)
- Database query results (if applicable):

  ```
   pay_ab5ca49a4a7557b639 | 1008 | succeeded | last_sequence 0 | 2026-11-03 14:32:55+00
   ledger 9 | credit | 200000 | return_url | 2026-11-03 14:32:55+00
  ```

## Notes
- Impact: any participant can unlock levels and rewards without paying. The queued `payment.updated`
  `succeeded` event would also tell n8n the payment succeeded once event delivery is fixed (see F-01).
- Same mechanism on a normal paid backing (receipt 1007, earlier run): the credit was written from the return
  URL about 0.7 s before FakePay's first webhook, so even honest payments are credited before confirmation.
- Declined payment, then forged return (`pay_8ddc95eb7eea544719`, FakePay `failed`,
  [`evidence/qa/F-04b-declined-then-forged-return.txt`](../evidence/qa/F-04b-declined-then-forged-return.txt)):
  the engine kept `status = failed` and wrote no credit, but the page still showed
  "You're in! … Level unlocked: Listener" (PR14). So the credit is written when the payment has not yet reached
  a final status from FakePay; once a webhook has set `failed`, only the message is wrong.
- Not verified: a declined card whose forged return arrives before the `payment.failed` webhook. Given the above,
  it is likely to be credited; not claimed.
- Related: TW-003 (replayed `payment.succeeded` webhook credits again).
