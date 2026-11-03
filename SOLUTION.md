# Solution Submission

**Candidate Name**: Joseph Bamidele  
**Repository URL**:  
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

### Sections A, B, D
_TODO (candidate)._

---

## 2. AI Disclosure Table

| Tool / Model | Section & Feature | What Was Prompted | What You Accepted vs Changed | What You Personally Ran and Verified |
|---|---|---|---|---|
| Claude Opus 5.5 (Claude Code, with Claude in Chrome) | Section C: bug hunt (F-04 to F-08), tickets TW-003 to TW-006 | Run FakePay webhook replay, return-URL, decline and receipt tests in the browser and via `qa_reader`; draft tickets from the evidence | _TODO (candidate)_ | _TODO (candidate)_ |
| Claude Opus 5.5 (Claude Code) | Section C: leads code review, PR-17 review, test plan | Review `leads-service/` and PR-17, verify findings against the running service, dry-run the migration, draft the review and test plan | _TODO (candidate)_ | _TODO (candidate)_ |
| | | | | |

---

## 3. Verification and Status Table

| Item / Feature | Status (PASS / FAIL / BLOCKED / NOT TESTED) | Evidence Link / File Reference | Notes |
|---|---|---|---|
| Playwright Suite (Section A) | _TODO_ | | |
| Lead Creation Workflow (Section B) | _TODO_ | | During CR checks it emailed a score-100 applicant "You're now an active Tidewave rep!" ([evidence](evidence/qa/leads/CR-live-checks.txt)) |
| Solace Events Workflow (Section B) | _TODO_ | [F-01 evidence](evidence/qa/F-01-optin-events-not-delivered.txt) | Engine events go to `/webhook-test/` and get 404 (F-01, configuration) |
| Staff Test Run Workflow (Section B) | _TODO_ | | |
| Engine Bug Findings (Section C) | FAIL (6 tickets) | [`tickets/`](tickets/), [`qa/INVESTIGATION_LOG.md`](qa/INVESTIGATION_LOG.md) | Breakdown below |
| Leads Service Review & PR-17 (Section C) | FAIL (7 verified findings; PR-17: request changes) | [`qa/LEADS_CODE_REVIEW.md`](qa/LEADS_CODE_REVIEW.md) | Breakdown below |
| Street Team Email Template (Section D) | _TODO_ | | |
| Solace Intro Email Template (Section D) | _TODO_ | | |
| Ops Console Test Screen (Section D) | _TODO_ | | |

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
| Leads: status ≥ 70 → `screening_invite` | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt) | CR-03 |
| Leads: never `active` | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt) | CR-02 |
| Leads: only admins change status | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt) | CR-01 |
| Leads: same person → `duplicate`, one email | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt) | CR-04 (two emails sent) |
| Leads: invalid input → 422 | FAIL | [CR checks](evidence/qa/leads/CR-live-checks.txt) | CR-05 (500 / accepted) |
| Leads: withdrawn consent → new lead | PASS | Seed `lead_seed_06`/`07`, [PR-17 dry run](evidence/qa/leads/PR-17-migration-dry-run.txt) | Duplicate query excludes withdrawn rows |
| Leads: double submit | PASS (not reproduced) | [CR checks](evidence/qa/leads/CR-live-checks.txt) | Race still possible in code (CR-07) |
| PR-17 | FAIL (request changes) | [PR-17 dry run](evidence/qa/leads/PR-17-migration-dry-run.txt) | FK failure, deletes consent-withdrawal record, misses the Kemi case |

---

## 4. What Was Not Done (Gaps and Trade-offs)

### Section C
- PR1–PR3, PR6, PR7, PR8, PR10, PR11 and PR13 were not tested (prioritised crediting, webhooks and data exposure).
  Next: XOF/USD quotes for rounding, an instalment pair crossing a level, card 0259 plus `tw.mjs clock 31` for
  expiry and late confirmation, a refund as admin and as viewer.
- Code-only leads findings (CR-06, CR-07, CR-08, CR-11 to CR-14) are risks, not reproduced defects.
- Regression tests for the leads defects belong in the Section A suite (`api` project) and reference CR-01 to CR-05.

### Sections A, B, D
_TODO (candidate)._
