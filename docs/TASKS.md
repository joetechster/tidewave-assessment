# Assessment Tasks

Complete the four sections below. Total time: 180 minutes. Total points: 100.

**Passing Criteria**: Minimum **65 / 100** overall score, with non-compensatory section floors:
- Section A (Playwright): **15 / 25**
- Section B (n8n Workflows): **21 / 35**
- Section C (QA Investigation): **15 / 25**
- Section D (Emails & Staff Screen): **8 / 15**
- Plus zero critical failures (no secrets, no duplicate emails, no unverified backing confirmations, no test emails to real recipients, no leaked customer data, no fabricated test claims).

---

## Section A: Playwright End-to-End Testing (25 Points)

Configure the starter suite in `playwright/` and write automated browser and API tests.

### Requirements & Acceptance Criteria
1. **Runner Configuration**:
   - Tests run cleanly using `npx playwright test`.
   - Projects configured for `storefront` (`http://localhost:7080`), `ops` (`http://localhost:7300`), and `api`.
   - Chromium only. Traces and screenshots enabled on run.
2. **Happy Path Coverage**:
   - Public website visitor journey: preview music, submit opt-in.
   - Persona login and account view on `/me`.
   - Ops console: sign in as Admin/Viewer, browse leads, view lead details and activity, view payments.
3. **Negative, Edge & Security Cases**:
   - At least one permission case (e.g. Viewer cannot trigger refunds).
   - At least one error or validation rejection case.
   - At least one double-submit prevention case.
4. **Planted Defect Exposure**:
   - Write at least one test that fails on the starter build because it triggers a planted defect. Reference the ticket ID from Section C that it proves.
   - For every code bug you identify in the leads service, write an automated test that reproduces it.
5. **Artifacts & Reliability**:
   - HTML report and traces saved in `playwright-report/` and `test-results/`.
   - Explain any flaky test or timing sensitivity in `SOLUTION.md`.

---

## Section B: Workflow Automation in n8n (35 Points)

Repair, harden, and complete the three n8n workflows in `n8n/`.

### Workflows
1. `street-team-lead` (`POST /webhook/street-team-lead`)
2. `solace-events` (`POST /webhook/solace-events`)
3. `staff-test-run` (`POST /webhook/staff-test-run`)

### Requirements & Acceptance Criteria
1. **Workflow Repairs**:
   - Fix broken node configurations, routing, and data mappings.
   - Street team lead workflow must never mark any applicant as "active", "hired", or "field ready".
   - Complete `staff-test-run` so staff can trigger template test runs from the ops console. Test runs must only send to `staff-test@tidewave.test`.
2. **Payment Verification Rule**:
   - Never send a "confirmed" backing email simply because an inbound event payload asserts success. Always query the engine (`GET /api/automation/payments/{id}`) to verify the backing with the provider before sending confirmation.
3. **Resilience & Idempotency**:
   - Deduplicate inbound events to ensure the same person never receives multiple emails for a single event or action.
   - Implement error handling and retry logic.
   - Handle downstream failure scenarios: prove recovery when engine returns 503 (`/__tools/chaos`) and when Mailpit returns transient errors (Mailpit Chaos 451).
4. **Export Workflows**:
   - Export your finished workflows as JSON into `n8n/workflows/`.
   - Execution logs must show clear step-by-step audit entries.
   - *Hint: Events from the engine do not always arrive. Investigate.*

---

## Section C: QA Investigation, Bug Hunt & Code Review (25 Points)

Investigate the system, conduct a structured bug hunt, and review open service code.

### Requirements & Acceptance Criteria
1. **Test Plan (1 Page)**:
   - Outline your test approach across payments, leads, and webhooks.
   - Document explicit questions regarding any business rules or product notes that are ambiguous or unspecified.
2. **Closed System Bug Hunt**:
   - Exercise the public website, payment flows, and FakePay gateway.
   - Inspect network traffic, responses, and read-only database tables (`qa_reader`).
   - Specifically test FakePay webhook flows: failure, webhook replay, and mismatched confirmation status.
   - File formal Plane-style tickets in `tickets/` using `docs/TICKET_TEMPLATE.md`.
   - *Report what you can prove. A wrong bug report costs points.*
3. **Code & PR Review**:
   - Perform a code review of the leads service repository.
   - Review open pull request `leads-service/pull-requests/PR-17`.
   - Document all security issues, logic errors, and scoring calculation flaws.
4. **Traceability Table**:
   - Complete the status table in `SOLUTION.md` with PASS / FAIL / BLOCKED / NOT TESTED statuses and links to evidence.

---

## Section D: Emails & Staff Test Screen (15 Points)

Improve candidate email templates and complete the staff test screen.

### Requirements & Acceptance Criteria
1. **Responsive Email Templates**:
   - Improve `templates/street-team-prospect.html` and `templates/solace-intro.html` according to `docs/EMAIL_BRIEFS.md`.
   - Layouts must be responsive and verified mobile-friendly at 375px width.
   - Include safe variable handling with sensible fallbacks.
   - Include explicit preheaders, clear calls-to-action, correct disclaimers, and functional unsubscribe links.
2. **Ops Console Test Screen (`/messages/test`)**:
   - Complete the starter stub at `ops-console/src/app/messages/test/page.tsx`.
   - A non-technical colleague must be able to:
     1. Select an approved template from a dropdown (exclude draft templates).
     2. Fill in input fields dynamically generated from template `variables` (labels, required indicators, example placeholders).
     3. View a live rendered HTML preview inside a sandboxed `<iframe srcdoc>`.
     4. Click "Send TEST run" to send the test email to `staff-test@tidewave.test` without manually editing JSON.
     5. See an immediate, unambiguous success or error notification.
   - Note: This is an internal staff test utility, not a full marketing automation platform.
