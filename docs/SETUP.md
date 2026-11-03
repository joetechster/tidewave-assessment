# Environment Setup

Follow these instructions to start the assessment environment.

If setup takes more than 20 minutes, stop and contact us.

---

## Prerequisites
- Docker Desktop (Windows / macOS) or Docker Engine with Docker Compose v2 (Linux).
- Node.js 22 to 24 installed locally.
- At least 8 GB RAM and approximately 10 GB free disk space.

---

## 1. Start Services
From the repository root, load the closed engine image once, then start the containers:

```bash
docker load -i images/tidewave-engine-1.0.0.tar
docker compose up -d
```

The first start takes about 3 minutes: n8n prepares its database and imports the starter workflows.

Verify service health using the automated setup check:

```bash
node tools/tw.mjs setup-check
```

---

## 2. Start the Ops Console
The ops console runs locally on your host machine:

```bash
cd ops-console
cp .env.local.example .env.local
npm ci
npm run dev
```

The ops console will be available at `http://localhost:7300`.

---

## 3. Playwright

```bash
cd playwright
npm ci
npx playwright install chromium
npx playwright test
```

If the browser download is slow or fails, skip it and use the Chrome already on your computer: `PW_CHANNEL=chrome npx playwright test` (PowerShell: `$env:PW_CHANNEL='chrome'; npx playwright test`).

## 4. Engine API documentation

Open `http://localhost:7080/api/docs` for the engine API, events and test tools. Helper commands: `node tools/tw.mjs` (reset, clock, chaos, redeliver, export-n8n, evidence).

## 5. URLs and Credentials

| Service | Local URL | Container Host & Port | Credentials / Notes |
|---|---|---|---|
| Public Website & Engine | `http://localhost:7080` | `engine:8080` | Persona logins below |
| FakePay Gateway | `http://localhost:7090` | `fakepay:8090` | Payment provider mock |
| Leads Service | `http://localhost:7081` | `leads:8081` | Open REST API |
| Ops Console | `http://localhost:7300` | Host only | Login: Admin or Viewer |
| n8n Automation | `http://localhost:7678` | `n8n:5678` | `assessor@tidewave.test` / `Tidewave!2026` |
| Mailpit UI | `http://localhost:7025` | `mailpit:8025` | Web email client |
| Mailpit SMTP | `mailpit:1025 (inside Docker only)` | `mailpit:1025` | SMTP port |
| Postgres Database | `localhost:7432` | `db:5432` | Database `tidewave` |

### Database Credentials

| Role | Username | Password | Access |
|---|---|---|---|
| QA Reader (Candidates) | `qa_reader` | `qa_reader_pw` | Read-only across schemas `engine` and `leads` |

### Persona Accounts (Public Website)
All personas use password: `listen123`
- `ada`
- `bayo`
- `kofi`
- `awa`
- `tunde`
- `zara`
- `musa`

### API Tokens

| Name | Token Value | Purpose |
|---|---|---|
| `STAFF_ADMIN_TOKEN` | `tw_staff_admin_5f2c9a` | Ops console admin calls |
| `STAFF_VIEWER_TOKEN` | `tw_staff_viewer_81d4e0` | Ops console viewer calls |
| `AUTOMATION_TOKEN` | `tw_automation_3b7e11` | n8n engine and leads calls |
| `TOOLS_TOKEN` | `tw_tools_c0ffee` | Reset, chaos, and clock controls |
| `EVENTS_SIGNING_SECRET` | `whsec_tidewave_demo_2f9a` | Webhook HMAC verification |
