# Playwright Starter Suite

This directory contains the Playwright test automation starter for Section A.

## Setup and Installation

Install dependencies and download the Chromium browser:

```bash
npm install
npx playwright install chromium
```

## Running Tests

Run the complete test suite across all configured projects:

```bash
npx playwright test
```

To run a specific project:

```bash
npx playwright test --project=storefront
npx playwright test --project=ops
npx playwright test --project=api
```

## Slow internet?

If `npx playwright install chromium` is slow or fails, use the Chrome or Edge already on your computer instead:

```bash
# macOS / Linux / Git Bash
PW_CHANNEL=chrome npx playwright test
# Windows PowerShell
$env:PW_CHANNEL='chrome'; npx playwright test
```

## Inspecting Reports and Traces

View the HTML test execution report:

```bash
npx playwright show-report
```

To inspect an individual trace file from a failed run:

```bash
npx playwright show-trace test-results/<folder-name>/trace.zip
```

## Continuous Integration (GitHub Actions)

This repository includes a documented GitHub Actions workflow at `.github/workflows/ci.yml`. When you push your commits to your GitHub repository, CI automatically starts the Docker environment, verifies service readiness, and runs the entire Playwright test suite.

Your test suite must include both:
1. **Positive Happy Path Tests:** Standard user journeys (opt-ins, persona sessions, quote/checkout navigation, ops console views).
2. **Negative & Boundary Cases:**
   - Authorization boundaries (e.g. Viewer role cannot access refund mutations).
   - Validation failures (empty forms, invalid email formats, below-minimum pledges).
   - Double-submit and replay defenses.
   - Provider payment decline handling (e.g. test card ending in `0002`).

Traces and HTML reports are automatically published as CI artifacts on every run.


```bash
npx playwright show-trace test-results/<test-run-folder>/trace.zip
```

## Evidence Submission

Your evidence is the HTML report and trace files. Commit `playwright-report/` and `test-results/`.
