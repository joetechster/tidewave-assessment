# Tidewave Street Team Leads Service

This service handles public applications for the Tidewave Street Team field representative programme, performs scoring and automated qualification, and integrates with downstream n8n automation workflows.

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8081` | HTTP port to listen on |
| `DATABASE_URL` | `postgres://leads_app:leads_pw@localhost:7432/tidewave` | PostgreSQL connection string |
| `STAFF_ADMIN_TOKEN` | `tw_staff_admin_5f2c9a` | Staff Admin API Bearer token |
| `STAFF_VIEWER_TOKEN` | `tw_staff_viewer_81d4e0` | Staff Viewer (Read-only) Bearer token |
| `AUTOMATION_TOKEN` | `tw_automation_3b7e11` | Downstream n8n automation Bearer token |
| `TOOLS_TOKEN` | `tw_tools_c0ffee` | Maintenance and reset Bearer token |
| `EVENTS_SIGNING_SECRET`| `whsec_tidewave_demo_2f9a` | HMAC secret for signing webhook events |
| `N8N_LEADS_EVENTS_URL` | `http://n8n:5678/webhook/street-team-lead` | n8n webhook target URL |
| `TEMPLATES_DIR` | `../templates` | Directory containing email templates |

## Running the Service

### Prerequisites
- Node.js 22
- PostgreSQL 16 database running with `tidewave` database and `leads` schema

### Development
```bash
npm run dev
```

### Production Build & Start
```bash
npm run build
npm start
```

### Running Tests
```bash
npm test
```

## API Endpoints

- `GET /health` — Service health check
- `POST /leads` — Public endpoint to submit a new street team application
- `GET /leads?page=1&pageSize=20&search=` — Staff endpoint to list/search leads
- `GET /leads/:id` — Staff / automation endpoint to retrieve lead details
- `PATCH /leads/:id/status` — Staff admin endpoint to update lead status
- `POST /leads/:id/activity` — Log an activity event for a lead
- `GET /leads/:id/activity` — List activity history for a lead
- `GET /templates` — List available email templates and required variables
- `POST /templates/:key/render` — Render an email template with variables
- `POST /__tools/reset` — Reset and re-seed the leads database (Tools token required)
