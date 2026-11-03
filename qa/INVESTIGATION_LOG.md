# QA Investigation Log

Running log of observations during the bug hunt. Items here are **not** tickets until reproduced
and proven; confirmed engine defects move to `tickets/`, workflow/config issues go to Section B.

---

## F-01: Solace Avenue opt-in sends no intro email (engine events never reach n8n)

**Classification**: Configuration / Section B (not filed as an engine ticket)  
**Status**: Root cause found, fix deferred  
**Persona**: ada  
**Evidence**: [`evidence/qa/F-01-optin-events-not-delivered.txt`](../evidence/qa/F-01-optin-events-not-delivered.txt)

### Steps
1. Log in to the public website (`http://localhost:7080`) as `ada` / `listen123`.
2. On the Solace Avenue page, submit "Get updates from Solace Avenue" with first name `ada`, email `ada@mail.test`, consent ticked.
3. Check Mailpit (`http://localhost:7025`).

### Expected
Listener receives the Solace intro email with a link to the campaign page (PRODUCT_NOTES §3).

### Actual
No email in Mailpit (`messages_count: 0`).

### Trace
| Stage | Result | Evidence |
|---|---|---|
| Opt-in stored | OK: `opt_fd861bb23fa6559153` (13:40:52Z), `opt_2cd9b3c38acdfb0512` (13:41:37Z), `opt_858a4e135d13866fe4` (13:46:12Z) | `engine.optins` |
| Event emitted | OK: `evt_7f39ed5c685bbaf4c8`, `evt_2c554c25a45b90ab9a`, `evt_82735f99a71b2fd354` (`optin.created`) | `engine.outbox` |
| Event delivered to n8n | **FAIL**: every attempt `last_status = 404`, `delivered_at` null, engine still retrying | `engine.outbox` |
| n8n workflow ran | Never reached | - |

### Root cause
`engine.settings.n8n_events_url = http://n8n:5678/webhook-test/solace-events`.
`/webhook-test/` is n8n's editor test URL, live only while "Listen for test event" is active.
The production path `/webhook/solace-events` is registered (GET returns "not registered for GET
requests. Did you mean to make a POST request?").

The URL is an admin-editable setting (`PUT /api/staff/settings` `{"n8nEventsUrl": ...}` per
`/api/docs`), so this is a deployment misconfiguration, not an engine code defect.

### Fix plan (order matters, to avoid the duplicate-email auto-fail)
1. Add event dedup to the `solace-events` workflow (Section B).
2. `node tools/tw.mjs reset` to clear the queued/retrying outbox events.
3. `PUT /api/staff/settings` with `n8nEventsUrl = http://n8n:5678/webhook/solace-events`.
4. Re-run the opt-in once and confirm exactly one email in Mailpit.

---

Also reproduced from the campaign page "Keep me posted" form (`req_218157b1a39d1d0530`,
13:46:12Z): opt-in stored, event `evt_82735f99a71b2fd354` stuck on 404, no email. Same root cause.

---

## F-02: Artist page marketing consent checkbox is pre-ticked

**Classification**: Public Website defect, **confirmed**, filed as [TW-001](../tickets/TW-001-artist-page-consent-prechecked.md)  
**Rule broken**: PRODUCT_NOTES §3: "The marketing consent box is unticked by default."  
**Evidence**: [`evidence/qa/F-02-F-03-optin-forms.txt`](../evidence/qa/F-02-F-03-optin-forms.txt)

- `GET /artist/solace-avenue` renders
  `<input type="checkbox" name="consent" value="yes" checked>` ("Yes, email me updates from Solace Avenue and Tidewave Music.").
- For comparison, the campaign page form (`/campaigns/harmattan-sessions`) renders the consent box unticked, as specified.
- Impact: a visitor who only types name + email is recorded as `consent = t` (both artist-page opt-ins,
  `opt_fd861bb23fa6559153` and `opt_2cd9b3c38acdfb0512`, have `consent = t`) and will be emailed. Consent is not freely given.
- Severity suggestion: High (consent/privacy).

---

## F-03: Opt-ins are attached to the closed campaign `coastline-ep`

**Classification**: Engine defect, **confirmed**, filed as [TW-002](../tickets/TW-002-optin-attached-to-closed-campaign.md)  
**Rule broken**: PRODUCT_NOTES §3 (intro email links to the campaign page the listener can back) and §4 (Harmattan Sessions is the active campaign; Coastline EP is closed)  
**Evidence**: [`evidence/qa/F-02-F-03-optin-forms.txt`](../evidence/qa/F-02-F-03-optin-forms.txt)

- Opt-in submitted **from the Harmattan Sessions campaign page** (`POST /optin` `req_218157b1a39d1d0530`,
  redirected to `/campaigns/harmattan-sessions?optin=1`) was stored as
  `opt_858a4e135d13866fe4` with `campaign_slug = coastline-ep`.
- Artist page opt-ins (`req_c1dc838404482ebea4`, `req_d9a4a2baede0b68cc9`) were also stored with `coastline-ep`.
- `engine.campaigns`: `coastline-ep.is_open = f`, `harmattan-sessions.is_open = t`.
- Neither form sends a campaign field (campaign page only sends hidden `from=campaign`), so the engine chooses the campaign server-side and picks the closed one.
- Event payloads carry the same `campaignSlug: coastline-ep`, so the intro email would link listeners to a closed campaign they cannot back.
- Severity suggestion: High (breaks the listener → backer journey).

---

Screenshots: [`F-02-artist-page-consent-prechecked.png`](../evidence/qa/F-02-artist-page-consent-prechecked.png),
[`F-02-campaign-page-consent-unticked.png`](../evidence/qa/F-02-campaign-page-consent-unticked.png).

---

## F-04: Backing is credited from the browser return URL, before FakePay confirms (suspected, needs negative repro)

**Classification**: Engine, **suspected Critical**, NOT yet a ticket  
**Rules at risk**: PR4 (counts only when FakePay confirms `succeeded`), PR14 ("You're in" only after confirmation)  
**Evidence**: [`evidence/qa/F-04-credit-from-return-url.txt`](../evidence/qa/F-04-credit-from-return-url.txt)

Happy-path payment by ada (NGN ₦2,000, receipt 1007, `pay_4fbfe9ba34d4782759` / `fp_760b3b2c6af26f5f40`):

| Time (UTC) | Event | Request |
|---|---|---|
| 13:50:15.005 | Card submitted on FakePay page, 303 | `req_b76465430d39b73e32` |
| 13:50:15.035 | Browser lands on `/checkout/return?payment=pay_4fbfe9ba34d4782759&status=success` | `req_830e75819b31bae953` |
| 13:50:15 | **Ledger credit 200000 kobo, `source = return_url`**; payment `status = succeeded` | `engine.ledger` id 7 |
| 13:50:15.714 | FakePay webhook `payment.processing` (seq 1) arrives | `req_fc66d3e7673f49b4de` |
| 13:50:16.419 | FakePay webhook `payment.succeeded` (seq 2) arrives | `req_86d1c904b5fc43ca0f` |

The credit and status change happen on the browser redirect, whose `status=success` is a user-controlled
query string, before any signed provider event. `payments.last_sequence` stays `0` after both webhooks.

Amounts on this payment look correct: amount ₦2,000, fee ₦100 (2.5% = ₦50 → minimum ₦100, PR5), charged ₦2,100, credit ₦2,000 (fee excluded) → level Listener.

**Repro still needed to prove the defect** (after `node tools/tw.mjs reset`):
1. As ada, start a backing and get redirected to the FakePay page `/pay/fp_...`. Note the `pay_...` id.
2. Do **not** pay (or use the decline test card).
3. Open `http://localhost:7080/checkout/return?payment=<pay_id>&status=success` manually.
4. Check: page says "You're in"? Level on campaign page increases?
   `select * from engine.ledger where payment_id='<pay_id>'` has a credit? `engine.payments.status`?
   `engine.fp_payments.status` for the ref (truth from FakePay)?
If credited without a FakePay `succeeded` → Critical ticket (PR4/PR14). If not → drop F-04.

---

## Open follow-ups (unverified)

| # | Observation | Next step | Likely destination |
|---|---|---|---|
| F-01b | `participantId` is `""` although the user was logged in as ada (request log actor `participant:ada`). | Check `/api/docs` for whether opt-ins should link to the session participant. | Ticket or ambiguity question |
| F-01c | `source` differs by page: artist page → `"Artist"`, campaign page (`from=campaign`) → `"artist"`. The campaign-page opt-in is labelled as artist source, and casing is inconsistent. Workflow node "Route Source" compares case-sensitively to `"artist"`, so artist-page events route to the street-team fallback template. | Check `/api/docs` for the documented `source` values. | Section B fix (normalise in workflow); engine ticket if docs define different values |
| F-01d | Same email opted in 3 times; all accepted, each with its own event. | Product notes don't say whether repeat opt-ins are rejected. | Test plan ambiguity question; Section B dedup must handle it |
| F-01e | Every event payload has `"sequence": 1`. | Check `/api/docs` for what `sequence` means (per-entity ordering vs global). | Possibly ticket, otherwise note |
| F-05 | Receipts are sequential numbers (`/me/receipts/1007`). | As ada, open `/me/receipts/1001` … `1006` (other personas' receipts). Any 200 showing another person's receipt breaks PR12. | Ticket if another persona's receipt is visible |
| F-06 | `payments.last_sequence = 0` after webhooks seq 1 and 2 were accepted. | Replay `fpevt_ed9f1e90ba7a6088d7` (processing, seq 1) after success: does status regress to processing / level drop? | Webhook replay / ordering ticket if state regresses |
