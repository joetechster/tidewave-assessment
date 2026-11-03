# TW-003: Replayed FakePay `payment.succeeded` webhook credits the backing again on every delivery

**Area**: Engine  
**Severity**: Critical  
**Environment**: Starter build, Persona: ada  
**Retest Status**: Open  

---

## Summary
When FakePay delivers a `payment.succeeded` event that the engine has already received (same event id,
valid signature), the engine adds a new ledger credit for the full backing amount each time. One
₦2,000 payment, confirmed once by FakePay, ended up as ₦6,000 of confirmed backing for ada after two
replays. Webhook delivery is at-least-once (FakePay states "Replay sends the same event (same id) to the
merchant again"), so the engine must handle a repeated event id idempotently.

## Steps to Reproduce
1. As `ada` / `listen123`, back Harmattan Sessions with ₦2,000 and pay on the FakePay page with test card
   `4242`. (Reproduced on receipt 1007, `pay_4fbfe9ba34d4782759` / `fp_760b3b2c6af26f5f40`.)
2. As `qa_reader`, note the ledger for the payment:
   `select id, kind, kobo, source from engine.ledger where payment_id = 'pay_4fbfe9ba34d4782759';`
3. Open the FakePay dashboard `http://localhost:7090/dashboard`. Under "Webhook events", click **Replay**
   on the `payment.succeeded` event for that FakePay ref (`fpevt_c4439b6f6d680aabe2`).
   (Equivalent: `curl -X POST http://localhost:7090/dashboard/events/fpevt_c4439b6f6d680aabe2/replay`.)
4. Re-run the ledger query. Click **Replay** on the same event again and re-run it.
5. Logged in as ada, open `http://localhost:7080/me`.

## Expected Behavior
- A webhook whose event id has already been processed is acknowledged and ignored. The ledger keeps one
  credit for the payment.
- A backing counts toward a level only as confirmed by FakePay (PRODUCT_NOTES PR4), and levels use the sum
  of confirmed backings (PR6). FakePay confirmed one ₦2,000 backing, so ada's confirmed backing is ₦2,000.

## Actual Behavior
Every replay of the same `payment.succeeded` event is accepted (200) and writes a new ₦2,000 credit with
`source = provider_webhook`:

| Ledger id | kind | kobo | source | created_at (UTC) |
|---|---|---|---|---|
| 7 | credit | 200000 | return_url | 2026-11-03 13:50:15 |
| 8 | credit | 200000 | provider_webhook | 2026-11-03 14:07:05 (1st replay) |
| 9 | credit | 200000 | provider_webhook | 2026-11-03 14:07:24 (2nd replay) |

- ada's Harmattan Sessions ledger total went from 200000 to **600000 kobo**.
- `/me` as ada shows "Confirmed backing: ₦6,000.00".
- Receipt 1007 still shows Backing ₦2,000.00, Fee ₦100.00, Charged ₦2,100.00.
- FakePay `GET /v1/payments/fp_760b3b2c6af26f5f40` (Bearer `fp_sk_test_tidewave`) still returns a single
  payment: `{"amountMinor":210000,"currency":"NGN","status":"succeeded",...}`.

## Evidence
- Request / Response IDs:
  - FakePay replay #1 `req_52f69eac42ee1a92a9` (303) → engine `POST /webhooks/fakepay` 200 `req_c3ad04430f1a81e796` → ledger id 8
  - FakePay replay #2 `req_de108c0b05efb14807` (303) → engine `POST /webhooks/fakepay` 200 `req_68496f4d457b4d51ff` → ledger id 9
  - Original deliveries: `req_fc66d3e7673f49b4de` (processing, seq 1), `req_86d1c904b5fc43ca0f` (succeeded, seq 2)
- Logs or console output:
  - Before: [`evidence/qa/F-06-before.txt`](../evidence/qa/F-06-before.txt)
  - After 1st `succeeded` replay: [`evidence/qa/F-06-after-succeeded.txt`](../evidence/qa/F-06-after-succeeded.txt)
  - After 2nd `succeeded` replay: [`evidence/qa/F-06-after-succeeded-2.txt`](../evidence/qa/F-06-after-succeeded-2.txt)
  - Pages as ada after replays: [`evidence/qa/F-06-pages-after.txt`](../evidence/qa/F-06-pages-after.txt)
- Screenshot / trace references: none (captured via curl and SQL).
- Database query results (if applicable):

  ```sql
  select id, event_id, type, sequence, received_at, signature_ok from engine.provider_inbox order by id;
  ```
  ```
   1 | fpevt_ed9f1e90ba7a6088d7 | payment.processing | 1 | 2026-11-03 13:50:15+00 | t
   2 | fpevt_c4439b6f6d680aabe2 | payment.succeeded  | 2 | 2026-11-03 13:50:16+00 | t
   3 | fpevt_ed9f1e90ba7a6088d7 | payment.processing | 1 | 2026-11-03 14:06:53+00 | t
   4 | fpevt_c4439b6f6d680aabe2 | payment.succeeded  | 2 | 2026-11-03 14:07:05+00 | t
   5 | fpevt_c4439b6f6d680aabe2 | payment.succeeded  | 2 | 2026-11-03 14:07:24+00 | t
  ```

## Notes
- Impact: anyone who can cause a duplicate delivery (provider retry after a timeout, a network blip, or a
  dashboard replay) inflates a backer's confirmed total and level without paying. Two more replays on this
  payment would lift ada to Supporter (₦10,000) on ₦2,000 paid; not executed.
- Root cause hypothesis: the engine does not dedupe on the provider event id. `engine.provider_inbox` has
  no unique constraint on `event_id`, so every delivery is stored and processed as new. The credit also
  appears not to check whether a `provider_webhook` credit already exists for the payment.
- On receipt 1007 the original `payment.succeeded` delivery at 13:50:16 did **not** credit, because the
  payment had already been credited from the browser return URL (TW-004). The duplicate credits come from
  repeated deliveries of an already-received event.
- **Clean reproduction (no return URL involved)**, after `node tools/tw.mjs reset`, receipt 1007
  `pay_1975042048e1686cc1` / `fp_12ced099ace932c0ec`: the card was submitted from the FakePay page without
  following the redirect, so `/checkout/return` was never called. The webhooks credited once
  (ledger id 7, `provider_webhook`, `last_sequence = 2`, total ₦2,000). Clicking **Replay** on
  `fpevt_cc9c7693cd1749344f` (`payment.succeeded`) in the FakePay dashboard (`req_37118669c7a7dbba10`
  → engine `req_31cfa8abf8d7da473b`, 200) added ledger id 8 (+200000, `provider_webhook`); `/me` then showed
  "Confirmed backing: ₦4,000.00". Evidence:
  [`F-06b-before.txt`](../evidence/qa/F-06b-before.txt),
  [`F-06b-after-replay.txt`](../evidence/qa/F-06b-after-replay.txt),
  [`F-06b-me-after-replay.jpg`](../evidence/qa/F-06b-me-after-replay.jpg).
- The replay does not queue a new `engine.outbox` event, so it does not cause a duplicate email; the damage is
  the ledger credit.
- Out-of-order replay is handled safely: replaying the older `payment.processing` event (seq 1) after
  success left `payments.status = succeeded` and the ledger unchanged (`req_a31110982df2c2085c`,
  [`evidence/qa/F-06-after-processing.txt`](../evidence/qa/F-06-after-processing.txt)).
- `payments.last_sequence` is updated when webhooks drive the payment (2 in the clean run) but stays `0` when
  the return URL marked it succeeded first.
- Not claimed: the campaign page progress line stays at "₦2,000.00 of ₦10,000.00 toward the next level" while
  `/me` shows the inflated total ([`F-06b-campaign-after-replay.jpg`](../evidence/qa/F-06b-campaign-after-replay.jpg));
  the two pages calculate differently and it is not yet clear which is intended.
