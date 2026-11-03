# Test Plan: Tidewave QA Investigation (Section C)

**Goal**: find defects that break the product rules (PRODUCT_NOTES §2–§4) in payments, webhooks and leads, and
report only what can be proven.  
**System**: engine and public site `:7080`, FakePay `:7090`, leads service `:7081`, n8n `:7678`, Mailpit `:7025`,
Postgres `:7432` (read-only `qa_reader`).

## Approach
- **Risk first**: money and personal data before cosmetics. Order: payment crediting, webhook handling, data
  exposure, lead scoring and duplicates, then email and display rules.
- **Oracle**: FakePay's own record (`GET /v1/payments/{ref}`, dashboard) is the truth for payment status; the
  product notes are the truth for business rules; `engine.*` / `leads.*` tables show what the system did.
- **Evidence standard**: before/after `qa_reader` snapshots, request ids from `engine.request_log`, screenshots,
  Mailpit lists. A finding becomes a ticket only after a reproduction; otherwise it stays "suspected" in
  [`INVESTIGATION_LOG.md`](INVESTIGATION_LOG.md).
- **Isolation**: `node tools/tw.mjs reset` before each payment scenario; one variable changed per run; test
  personas and `.test` addresses only.
- **Techniques**: state transitions (payment created → processing → succeeded/failed/expired), boundary values
  (score 49/50/69/70, ₦1,000 minimum, fee minimum ₦100, 30-minute expiry), negative and authorization tests
  (other users' data, viewer vs admin, forged query strings), idempotency (replay, double submit), and code
  reading for the open-source leads service.

## Coverage
| Area | What is tested | Tools |
|---|---|---|
| Payments | Quote, fee and rounding (PR1–PR3, PR5), confirmation only from FakePay (PR4, PR14), instalments and levels (PR6), expiry and late confirmation (PR7, `tw.mjs clock`), history and receipts (PR8, PR9, PR12), refunds and referral (PR10, PR11, PR13) | Browser, FakePay test cards 4242 / 0002 / 0259, SQL |
| Webhooks | Failure (`payment.failed`), replay of old and duplicate events, out-of-order delivery, mismatched status (return URL vs FakePay), signature presence | FakePay dashboard Replay, `provider_inbox`, `ledger` |
| Leads | Required fields and 422s, scoring and status boundaries, duplicates (case, whitespace, phone format, withdrawn consent), role permissions, status rules ("never active"), template rendering, PR-17 | curl against `:7081`, code review, rolled-back SQL dry runs |
| Opt-ins and events | Consent default, campaign attached, event delivery to n8n, emails sent once | Browser, `engine.outbox`, Mailpit |

**Out of scope**: performance and load; the n8n workflows themselves (Section B); email layout (Section D).  
**Exit**: every PR rule and lead rule has a PASS / FAIL / NOT TESTED status in `SOLUTION.md` §3.

## Open questions about the rules
1. **Repeat opt-ins**: if the same email opts in again, should it be a new record, an update, or rejected? Should a
   second intro email be sent? (Three opt-ins for one email were all accepted, F-01d.)
2. **Which campaign** does an artist-page opt-in belong to when the form sends none? (TW-002 assumes the active one.)
3. **"Same person"** for leads: email or phone? Case-insensitive and trimmed? Is `08031234567` the same phone as
   `+2348031234567`? Is a different email with the same phone a duplicate?
4. **Experience years** are not said to be whole numbers: does 2.5 years score as "1–2" or "3+"? Are there maximum
   values for hours or years?
5. **City matching**: does "lagos ", "Lagos Island" or "Ikeja" count as Lagos?
6. **Return page while waiting**: what should `/checkout/return` show before FakePay confirms (PR14 only says when
   "You're in" may appear)?
7. **Expired then confirmed (PR7)**: should the backer be told, and does "You're in" or an email follow the late credit?
8. **Quote lock vs expiry**: PR1 locks a quote for 30 minutes and PR7 expires a pending payment after 30 minutes.
   Which clock starts first, and which rate applies if the quote expires mid-payment?
9. **Referral after release (PR10/PR11)**: if a refund happens after the 7-day hold, is released referral credit
   clawed back? Is the ₦2,000 cap per campaign over its whole life?
10. **PR8 "amount actually paid"**: does history show the backing or the charged amount including the fee?
11. **Which total is right**: `/me` "Confirmed backing" and the campaign page progress line can disagree (seen in
    F-06). Which is the source of truth for levels?
12. **Event `sequence`**: per payment/opt-in or global? Every opt-in event has `sequence: 1` (F-01e).
