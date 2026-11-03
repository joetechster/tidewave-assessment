# Tidewave Music Assessment

Welcome to the Tidewave Music technical assessment.

## Role Overview
This assessment evaluates a frontend-strong full-stack engineer who also owns end-to-end quality assurance (Playwright) and workflow automation (n8n).

## The System
Tidewave Music is a fictional music company. The system consists of multiple services:

### Closed Components (Black Box)
- **Engine & Public Website**: Runs on port 8080.
- **FakePay Provider**: Runs on port 8090.
- **Postgres Database**: Schema `engine`.

You do not have access to source code for closed components. Test them from the outside using the browser, browser DevTools, curl/Postman, container logs, and read-only database queries (`qa_reader` / `qa_reader_pw`). Report defects you find in closed components. Do not attempt to decompile or modify them.

### Open Components (White Box)
- **Leads Service**: Node.js microservice (`leads-service/`, port 8081).
- **Ops Console**: Next.js staff interface (`ops-console/`, port 3000).
- **Automation Workflows**: n8n instance (port 5678).
- **Email Templates**: HTML and metadata templates (`templates/`).
- **Test Automation Suite**: Playwright starter (`playwright/`).

You have full source access to open components. You will fix defects, write tests, and implement missing features inside them.

---

## Time and Structure
You have **180 minutes** of working time after completing environment setup. You may complete the sections in any order.

Suggested time allocation:
- **Orientation**: 5 minutes
- **Section C (QA & Bug Hunt)**: 45 minutes
  - Test plan: 5 minutes
  - Closed engine/website hunt: 25 minutes
  - Code & PR review: 15 minutes
- **Section A (Playwright)**: 35 minutes
- **Section B (n8n Workflows)**: 60 minutes
- **Section D (Emails & Staff Screen)**: 30 minutes
- **Wrap-up & Evidence Export**: 5 minutes

### Scoring & Passing Thresholds
Total score: **100 points**
- **Section A (Playwright)**: 25 points (Minimum floor: **15 / 25**)
- **Section B (n8n Workflows)**: 35 points (Minimum floor: **21 / 35**)
- **Section C (QA & Investigation)**: 25 points (Minimum floor: **15 / 25**)
- **Section D (Email Templates & Staff Screen)**: 15 points (Minimum floor: **8 / 15**)

To pass, a candidate must achieve an **overall score of at least 65 / 100 AND meet the minimum floor in all four sections**. Strong performance in one section cannot compensate for falling below the floor in another. Detailed criteria are defined in `TASKS.md`.

---

## AI Policy
- AI coding assistants and LLMs are permitted.
- In `SOLUTION.md`, you must document every AI tool used: which sections, what you prompted, what you accepted versus modified, and what you personally ran and tested.
- You must be able to explain all submitted code and decisions during the live technical walkthrough.
- A bug report with no reproducible evidence or automated test earns zero points.
- The live walkthrough includes a short, announced 5-minute section conducted without AI assistance.

---

## Evidence Requirements
We evaluate real runtime evidence, not theoretical explanations:
- Playwright HTML reports and trace files (`playwright-report/`, `test-results/`).
- Exported n8n workflow JSON files and execution screenshots.
- HTTP request and response transcripts (curl or test runner).
- SQL query outputs.
- Mailpit inbox screenshots.
- At the end of your session, run `node tools/tw.mjs evidence`. This exports a cryptographically signed server log. Identifiers in your tickets and solution report must match this log.

---

## Submission Process
1. Create a new **PUBLIC** GitHub repository under your own account.
2. Your first commit must be this starter, unchanged.
3. Commit as you work, with clear messages. Do not squash or rewrite your history.
4. When you finish, push everything: your code, `n8n/workflows/`, `tickets/`, `SOLUTION.md`, `playwright-report/`, `test-results/` and `evidence/`.
5. **Reply to the assessment email with the link to your repository.** The time of your last commit is your finish time.
6. Do not delete or change the repository until we confirm we have reviewed it.

---

## Automatic Fail Conditions
A submission automatically fails if any of the following occur:
- Committing a real or sensitive secret.
- Sending duplicate emails for a single event.
- Sending a "confirmed" backing email for an unverified or failed payment.
- Sending an email to an address outside the test domain (`.test`) or reaching a real person.
- Exposing private personal data in open code or logs.
- Claiming a test or scenario passed when execution logs show it was never run.
