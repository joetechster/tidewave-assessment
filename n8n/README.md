# Tidewave n8n Starter Workflows

This directory contains starter n8n workflows for the Tidewave assessment.

## Workflows Overview

1. **`street-team-lead.json`** (`POST /webhook/street-team-lead`)  
   Triggered by `lead.created` events from the Leads Service. Fetches the lead details, renders the `street-team-prospect` email template, delivers the welcome email via Mailpit SMTP, and logs an `email_sent` activity in the Leads Service.

2. **`solace-events.json`** (`POST /webhook/solace-events`)  
   Handles events emitted by the Tidewave Engine:
   - `optin.created`: Routes fan opt-ins, renders the `solace-intro` template, and sends an introductory email with campaign links.
   - `payment.updated`: Verifies payment completion and sends confirmation emails to campaign backers.

3. **`staff-test-run.json`** (`POST /webhook/staff-test-run`)  
   Invoked by staff members from the Ops Console to preview and test render templates with sample variables before production broadcasts.

## Importing Workflows

Workflows are designed for **n8n 2.42.0** and use only standard built-in nodes.

### CLI Import
```bash
n8n import:workflow --input=workflows/street-team-lead.json
n8n import:workflow --input=workflows/solace-events.json
n8n import:workflow --input=workflows/staff-test-run.json
```

### Credentials
These workflows reference pre-provisioned credentials:
- `cred_mailpit_smtp`: Mailpit SMTP configuration (host: `mailpit`, port: `1025`)
- `cred_tidewave_automation`: HTTP Header Authentication with `tw_automation_3b7e11`
