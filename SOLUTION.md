# Solution Submission

**Candidate Name**: Joseph Bamidele  
**Repository URL**: https://github.com/joetechster/tidewave-assessment  
**Submission Date**: 2026-11-03  

---

## 1. Technical Decisions and Architecture

### Section C: QA Investigation
- **Plan**: [`qa/TEST_PLAN.md`](qa/TEST_PLAN.md), risk-first (money and personal data first), with the open
  questions about ambiguous rules.
- **Working log**: [`qa/INVESTIGATION_LOG.md`](qa/INVESTIGATION_LOG.md) records every observation (F-xx).
  Nothing became a ticket until it was reproduced; suspected items stayed in the log.
- **Source of truth for payments**: FakePay's own API/dashboard, compared against `engine.payments`,
  `engine.ledger` and `engine.provider_inbox` (read as `qa_reader`), with before/after snapshots per test.
- **Isolating causes**: the webhook replay defect (TW-003) was first seen on a payment that had also been credited
  from the return URL, so it was re-run after a reset with a webhook-only credit (card submitted without following
  the redirect) to prove it independently of TW-004.
- **Leads service**: full source read plus live checks against `:7081`; PR-17's migration was executed inside
  `BEGIN … ROLLBACK` so nothing was changed. See [`qa/LEADS_CODE_REVIEW.md`](qa/LEADS_CODE_REVIEW.md).

### Section D: Emails & Staff Test Screen
- **Templates** (`templates/street-team-prospect.html`, `templates/solace-intro.html`): 600px table layout with a
  `max-width:600px` media query, inline styles for mail clients, a hidden preheader, a CTA button plus a plain-link
  fallback, the brief's disclaimers, and an unsubscribe link. Every variable has a `{{#if}}` fallback (e.g.
  "Hello there,", default campaign/screening links). The site has no unsubscribe page, so I added an optional
  `unsubscribeUrl` variable; it falls back to `mailto:unsubscribe@tidewave.test` (stays inside the test domain).
- **Renderer** (`leads-service/src/templates.ts`): fallbacks could not work because missing variables rendered as the
  text `undefined` (CR-08). Declared variables are now normalised to strings, `*Url` variables only accept
  `http(s):`/`mailto:` (a `javascript:` link falls back to the default), and the plain-text part no longer includes
  `<head>`/CSS. Handlebars `{{ }}` already HTML-escapes values.
- **Staff screen** (`ops-console/src/app/messages/test/page.tsx`): dropdown filtered to `status === 'approved'`; one
  input per template variable with its label, a required marker (`aria-required`) and `e.g. <example>` placeholder;
  a debounced preview through the existing render route into `<iframe sandbox="" srcdoc>` with a 375px toggle;
  "Send TEST run" posts plain fields (no JSON); the result shows beside the button ("Sent. … delivered to
  staff-test@tidewave.test." or "Not sent. …") and clears once the form is edited.
- **Defence in depth**: the API route (`ops-console/src/app/api/messages/test-run/route.ts`) re-checks on the server
  (approved template, required fields, only declared variables forwarded), and the `staff-test-run` workflow
  hard-codes the recipient. It previously used `variables.email` when supplied.

### Section A: Playwright
- **Projects**: `storefront` (`:7080`), `ops` (`:7300`), `api` (leads `:7081`, n8n, Mailpit), Chromium only,
  `trace: 'on'`, `screenshot: 'on'`, HTML report. `workers: 1`: every spec shares one seeded engine and leads
  database, and several call `resetAll()`, so parallel files would wipe each other's data.
- **Specs**: `storefront/visitor` (preview, opt-in, validation), `storefront/backer` (persona `/me`, backing,
  decline, minimum), `storefront/automation` (Section B end to end), `ops/console` (Admin/Viewer journeys, refund
  permission), `ops/messages-test` (Section D screen, double-click sends one), `api/leads`, `api/templates`,
  `api/workflows`.
- **Planted defects**: tests tagged `@defect` assert the product rule and carry a `ticket` / `code-review`
  annotation. They fail on the starter build because of the defect: TW-001, TW-004, and CR-01, CR-02, CR-03,
  CR-04 (×2), CR-05 (×2), CR-09 and CR-10 in [`api/leads.spec.ts`](playwright/tests/api/leads.spec.ts). CR-08 is fixed
  and covered by `api/templates.spec.ts`. `npx playwright test --grep-invert @defect` is the green regression run.
- **Shared state**: `fixtures.ts` holds the helpers (reset, persona login, checkout, Mailpit, chaos, signed
  events). Test identities are unique `@mail.test` addresses, so reruns never collide as duplicates.

### Section B: n8n workflows
- **Why events "do not always arrive"**: `/__tools/reset` sets the engine's `n8nEventsUrl` to
  `http://n8n:5678/webhook-test/solace-events`. That path only works while the n8n editor is listening, so every
  delivery got 404 and was retried until the engine gave up (F-01). The fix is configuration:
  `PUT /api/staff/settings {"n8nEventsUrl":"http://n8n:5678/webhook/solace-events"}` (admin), applied after every
  reset by `resetAll()`. Pending outbox events are then delivered on their next retry.
- **Signed events only**: both event webhooks take the raw body. The Crypto node computes
  HMAC-SHA256 over `t.body` with a new n8n credential (`cred_tidewave_events_signing` in
  `tools/n8n/credentials.json`, so the secret is not in workflow JSON). A Code node compares in constant time and
  rejects timestamps older than 1 hour, because engine retries run for about 45 minutes. Anything else gets 401.
- **Payment verification**: `payment.updated` only names the payment. The workflow calls
  `GET /api/automation/payments/{id}` and sends `solace-confirmed` only when `status === 'succeeded'` and
  `verifiedWithProvider === true`. Name, address, amount and level come from that response, not the event.
- **Idempotency**: each email has one claim key in n8n's Remove Duplicates store (database-backed, survives
  restarts): `solace-confirmed:<paymentId>`, `solace-intro:<email>:<campaign>`, `street-team-prospect:<leadId>`.
  Claims happen after the decision to send and before rendering, so replays, engine redeliveries, new event ids
  for the same payment, and repeat opt-ins get `{"action":"duplicate"}` and no email.
- **Retries and failures**: engine and leads calls retry 5× (2 s apart, 4 s timeout); SMTP retries 5× (5 s apart).
  If the engine still cannot verify, the workflow answers **503** before claiming, so the engine redelivers
  later. A 404 means the record does not exist: answer 200 "skipped", no redelivery loop. If sending fails after
  the claim, a Stop and Error node fails the execution with the key in the message, so it can be retried from the
  failed node in n8n.
- **Rule fixes**: street-team mail goes to `screening_invite` leads only, decided from the stored lead. The
  "You're now an active Tidewave rep!" subject is gone. Every Solace opt-in with `consent === true` gets the Solace
  intro: the old case-sensitive `source` switch sent artist-page fans the street-team template, and consent was
  never checked. JSON bodies are built with `JSON.stringify` instead of string interpolation.
- **Audit**: every node has a descriptive name, and executions are saved for success, error and manual runs.
  Confirmations add an `email_sent` engine activity, follow-ups add a lead activity.
  [`evidence/section-b/n8n-execution-audit.txt`](evidence/section-b/n8n-execution-audit.txt) lists the outcome of
  each execution and the node-by-node path for the recovery cases. [`evidence/n8n-executions.json`](evidence/n8n-executions.json)
  is the raw export (`tools/tw.mjs` asked n8n for 250 executions, which n8n 2.42 rejects; fixed to 100).

---

## 2. AI Disclosure Table

| Tool / Model | Section & Feature | What Was Prompted | What You Accepted vs Changed | What You Personally Ran and Verified |
|---|---|---|---|---|
| Claude Opus 5.5 (Claude Code, with Claude in Chrome) | Section C: bug hunt (F-04 to F-08), tickets TW-003 to TW-006 | Run FakePay webhook replay, return-URL, decline and receipt tests in the browser and via `qa_reader`; draft tickets from the evidence | Accepted after my review | Cross-checked each ticket (TW-003 to TW-006) and the F-04 to F-08 log entries against their evidence |
| Claude Opus 5.5 (Claude Code) | Section C: leads code review, PR-17 review, test plan | Review `leads-service/` and PR-17, verify findings against the running service, dry-run the migration, draft the review and test plan | Accepted after my review | Cross-checked each CR finding, the PR-17 review and the test plan against the code and evidence |
| Claude Opus 5.5 (Claude Code, with Claude in Chrome) | Section D: both email templates, renderer fix, `/messages/test` screen, test-run API checks, `staff-test-run` recipient lock, Playwright Section D specs | "Clean up section D … keep going until the score is acceptable"; then "score section D and fix everything causing a low score" | Accepted after my review | Cross-checked both templates, the renderer fix, the `/messages/test` screen and the Section D specs and evidence |
| Claude Opus 5.5 (Claude Code) | Sections A and B: leads `@defect` tests, n8n workflow rebuild, workflow Playwright specs, `tw.mjs` export fix, Section B evidence | "continue the section a and b tasks from previous sessions" | Accepted after my review | Cross-checked the leads tests, the three workflows, the workflow specs, the Playwright report and the Section B evidence |

---

## 3. Verification and Status Table

| Item / Feature | Status (PASS / FAIL / BLOCKED / NOT TESTED) | Evidence Link / File Reference | Notes |
|---|---|---|---|
| Playwright Suite (Section A) | PASS (52 passed; 11 `@defect` tests fail as intended) | [`playwright/playwright-report/`](playwright/playwright-report/index.html), [`playwright/test-results/`](playwright/test-results/) | Failures are exactly TW-001, TW-004 and the 9 leads `@defect` tests |
| Lead Creation Workflow (Section B) | PASS | [workflow spec](playwright/tests/api/workflows.spec.ts), [audit](evidence/section-b/n8n-execution-audit.txt) | Screening invite gets one email without "active"/"hired"/"field ready"; `needs_review`/`not_now` get none; replay is a duplicate. The starter emailed "You're now an active Tidewave rep!" ([evidence](evidence/qa/leads/CR-live-checks.txt)) |
| Solace Events Workflow (Section B) | PASS | [automation spec](playwright/tests/storefront/automation.spec.ts), [audit](evidence/section-b/n8n-execution-audit.txt) | One confirmation per payment under redelivery and replay; forged "succeeded" sends nothing; recovers from engine 503 ×2 (node retries) and ×6 (engine redelivery) and Mailpit 451; intro only with consent, once per person and campaign |
| Staff Test Run Workflow (Section B) | PASS | [workflow spec](playwright/tests/api/workflows.spec.ts), [API spec](playwright/tests/api/templates.spec.ts) | Only `staff-test@tidewave.test`; drafts and missing required variables get 400 even when n8n is called directly |
| Engine Bug Findings (Section C) | FAIL (6 tickets) | [`tickets/`](tickets/), [`qa/INVESTIGATION_LOG.md`](qa/INVESTIGATION_LOG.md) | Breakdown below |
| Leads Service Review & PR-17 (Section C) | FAIL (7 verified findings; PR-17: request changes) | [`qa/LEADS_CODE_REVIEW.md`](qa/LEADS_CODE_REVIEW.md) | Breakdown below |
| Street Team Email Template (Section D) | PASS | [API spec](playwright/tests/api/templates.spec.ts), [375px spec](playwright/tests/ops/messages-test.spec.ts), [375px screenshot](evidence/section-d/D-street-team-prospect-375-playwright.png), [Mailpit](evidence/section-d/D-mailpit-staff-test-inbox.jpg) | Brief must-include / must-not-say asserted; no horizontal scroll at 375px |
| Solace Intro Email Template (Section D) | PASS | [API spec](playwright/tests/api/templates.spec.ts), [375px spec](playwright/tests/ops/messages-test.spec.ts), [375px screenshot](evidence/section-d/D-solace-intro-375-playwright.png), [preview](evidence/section-d/D-solace-intro-mobile-375-preview.jpg) | Copy no longer promises previews (campaign page has no audio) |
| Ops Console Test Screen (Section D) | PASS | [ops spec](playwright/tests/ops/messages-test.spec.ts), [Mailpit](evidence/section-d/D-mailpit-staff-test-inbox.jpg) | Double-click sends one email; drafts/missing fields/anonymous rejected by the API |

### Section C traceability

| Rule / Flow | Status | Evidence | Ticket / Note |
|---|---|---|---|
| §3 Consent box unticked by default | FAIL | [F-02 evidence](evidence/qa/F-02-F-03-optin-forms.txt), [screenshot](evidence/qa/F-02-artist-page-consent-prechecked.png) | [TW-001](tickets/TW-001-artist-page-consent-prechecked.md) |
| §3 Intro email links to the active campaign | FAIL | [F-02/F-03 evidence](evidence/qa/F-02-F-03-optin-forms.txt) | [TW-002](tickets/TW-002-optin-attached-to-closed-campaign.md) |
| §3 Opt-in triggers intro email | FAIL | [F-01 evidence](evidence/qa/F-01-optin-events-not-delivered.txt) | F-01: config (n8n URL), fixed in Section B |
| PR4 / PR14 Credit and "You're in" only after FakePay confirms | FAIL | [before](evidence/qa/F-04b-before.txt), [after](evidence/qa/F-04b-after-forged-return.txt), [screenshot](evidence/qa/F-04b-youre-in-unpaid.jpg) | [TW-004](tickets/TW-004-backing-credited-from-return-url.md) |
| FakePay webhook: mismatched confirmation status | FAIL | same as above; [declined variant](evidence/qa/F-04b-declined-then-forged-return.txt) | TW-004 (FakePay `created`/`failed`, engine says "You're in") |
| FakePay webhook: replay of `payment.succeeded` | FAIL | [clean run before](evidence/qa/F-06b-before.txt), [after](evidence/qa/F-06b-after-replay.txt), [first run](evidence/qa/F-06-after-succeeded-2.txt) | [TW-003](tickets/TW-003-webhook-replay-double-credits-backing.md) |
| FakePay webhook: replay of old `payment.processing` after success | PASS | [F-06 after processing replay](evidence/qa/F-06-after-processing.txt) | Status stayed `succeeded`, no ledger change |
| FakePay webhook: failure (decline card 0002) | PASS | [F-07](evidence/qa/F-07-decline.txt) | `failed`, no credit, "You have not been charged" |
| PR5 Fee 2.5%, minimum ₦100, shown separately | PASS | [F-04 evidence](evidence/qa/F-04-credit-from-return-url.txt), [receipts](evidence/qa/F-05-receipts-other-participants.txt) | ₦2,000 → ₦100 (minimum); ₦10,000 → ₦250 |
| PR9 Receipts in Lagos time | FAIL | [F-08](evidence/qa/F-08-receipt-time-not-lagos.txt), [screenshot](evidence/qa/F-05-F-08-receipt-1003-as-ada.jpg) | [TW-006](tickets/TW-006-receipt-time-not-lagos.md) |
| PR12 Only own receipts visible | FAIL | [F-05](evidence/qa/F-05-receipts-other-participants.txt), [screenshot](evidence/qa/F-05-F-08-receipt-1003-as-ada.jpg) | [TW-005](tickets/TW-005-receipts-visible-to-other-participants.md) |
| PR1–PR3 Currency conversion and rounding | NOT TESTED | | |
| PR6 Instalments, minimum ₦1,000 | NOT TESTED | | |
| PR7 Expiry and late confirmation | NOT TESTED | | Needs `tw.mjs clock` and card 0259 |
| PR8 History amounts | NOT TESTED | | |
| PR10 Referral credit | NOT TESTED | | |
| PR11 / PR13 Refunds, admin-only | NOT TESTED | | |
| Leads: status ≥ 70 → `screening_invite` | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt), [regression test](playwright/tests/api/leads.spec.ts) | CR-03 |
| Leads: never `active` | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt), [regression test](playwright/tests/api/leads.spec.ts) | CR-02 |
| Leads: only admins change status | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt), [regression test](playwright/tests/api/leads.spec.ts) | CR-01 |
| Leads: same person → `duplicate`, one email | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt), [regression test](playwright/tests/api/leads.spec.ts) | CR-04 (two emails sent) |
| Leads: invalid input → 422 | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt), [regression test](playwright/tests/api/leads.spec.ts) | CR-05 (500 / accepted) |
| Leads: withdrawn consent → new lead | PASS | Seed `lead_seed_06`/`07`, [PR-17 dry run](evidence/qa/leads/PR-17-migration-dry-run.txt) | Duplicate query excludes withdrawn rows |
| Leads: double submit | PASS (not reproduced) | [CR checks](evidence/qa/leads/CR-live-checks.txt) | Race still possible in code (CR-07) |
| PR-17 | FAIL (request changes) | [PR-17 dry run](evidence/qa/leads/PR-17-migration-dry-run.txt) | FK failure, deletes consent-withdrawal record, misses the Kemi case |

---

## 4. What Was Not Done (Gaps and Trade-offs)

### Section C
- PR1–PR3, PR6, PR7, PR8, PR10, PR11 and PR13 were not tested (prioritised crediting, webhooks and data exposure).
  Next: XOF/USD quotes for rounding, an instalment pair crossing a level, card 0259 plus `tw.mjs clock 31` for
  expiry and late confirmation, a refund as admin and as viewer.
- Code-only leads findings (CR-07, CR-11 to CR-14) are risks, not reproduced defects. CR-06 was later seen live
  through n8n (Section B audit, execution 107); CR-08 is fixed.
- Regression tests for CR-01 to CR-05, CR-09 and CR-10 are in `playwright/tests/api/leads.spec.ts` (`@defect`).

### Section D
- Unsubscribe is a `mailto:` fallback because neither the engine nor the leads service has an unsubscribe endpoint;
  a real flow needs a signed per-recipient URL and a suppression list checked by the workflows.
- `solace-confirmed` (approved, used by Section B) was not restyled; it is outside the two briefs.
- The render API still renders draft templates (CR-10). The screen and the test-run API block drafts from being
  sent, but the render endpoint itself is unchanged.
- Timing: the send assertion allows 20s (n8n render + SMTP, plus first-request compiles under `next dev`), Mailpit
  is polled for up to 15s, and the duplicate check waits 3s after the first email arrives. The ops spec passed
  3 runs in a row. Run with `PW_CHANNEL=chrome` if the bundled headless shell is not installed.

### Section A
- **Timing sensitivity** (no test was flaky in the final runs; these are the waits that could make one flaky):
  - FakePay webhooks land about 1 s after the redirect, so `/me` is polled for up to 15 s.
  - Workflow emails are polled in Mailpit for up to 20 s (60 s when the engine has to redeliver).
  - "No second email" checks wait 4–6 s after the first, longer than n8n takes to process a duplicate (under 1 s).
  - The Mailpit 451 test keeps chaos on for 6 s, then turns it off. The SMTP node retries 5× at 5 s, so recovery
    happens inside the same execution.
  - The "503 ×6" test depends on the engine's 5 s redelivery and takes about 20 s.
  - `next dev` compiles routes on first hit; the ops tests warm the routes first (`70d905a`).
- **Not covered**: currency, instalment, expiry and referral rules (see Section C gaps). The CR-07 race cannot be
  forced reliably from a test.
- The 11 `@defect` tests fail by design until the engine and leads defects are fixed, so a plain
  `npx playwright test` exits non-zero. Use `--grep-invert @defect` for a green regression gate.

### Section B
- **Reset clears the fix**: the engine setting is not persistent across `/__tools/reset`. Outside the test suite,
  re-apply it after `node tools/tw.mjs reset` (the `PUT` in Section 1). n8n cannot make the engine's
  `/webhook-test/` path work without the editor open.
- **Claim before send**: a claimed email whose send then fails for good (5 SMTP tries over about 20 s) is not
  sent automatically on a later redelivery. That redelivery is a duplicate by design, because a double send is
  worse than a held one. The failed execution names the key, and "Retry" in n8n resumes from the failed node.
  A real system would use a transactional outbox with a sent/failed state per key.
- **Claim race**: two deliveries of the same action that reach the claim node within milliseconds could both
  pass, because the Remove Duplicates store is check-then-record, not a unique constraint. The engine spaces
  retries at least 5 s apart, so this was not seen. A database unique key would close it.
- **One intro per person and campaign**: repeat opt-ins get one email (TEST_PLAN question on repeat opt-ins).
  The intro links to the event's `campaignSlug`. The artist page still attaches opt-ins to the closed
  campaign (TW-002), which is an engine fix, not a workflow one.
- `staff-test-run` has no caller authentication; it is reachable on `localhost:7678`. Impact is limited because it
  can only mail `staff-test@tidewave.test`. The fix is a header-auth credential shared with the ops console.
- Lead follow-ups use a fixed next-step text and `http://localhost:7080/street-team` (the template's example
  `/street-team/screening` is 404). `needs_review` leads get no email until staff review them.
