# TW-001: Artist page marketing consent checkbox is pre-ticked

**Area**: Public Website  
**Severity**: High  
**Environment**: Starter build, Persona: ada  
**Retest Status**: Open  

---

## Summary
The "Get updates from Solace Avenue" opt-in form on the artist page renders the marketing consent
checkbox already ticked. A visitor who only enters a first name and email and clicks "Get updates" is
stored with `consent = true` and becomes eligible for marketing email without actively opting in.
The product notes require the consent box to be unticked by default.

## Steps to Reproduce
1. Open `http://localhost:7080/artist/solace-avenue` (logged in as `ada` / `listen123`; also reproducible logged out).
2. Scroll to "Get updates from Solace Avenue".
3. Observe the checkbox "Yes, email me updates from Solace Avenue and Tidewave Music." before touching it.
4. Optional: enter a first name and email without touching the checkbox, click "Get updates", then query
   `select id, consent from engine.optins order by created_at desc limit 1;` as `qa_reader`.

## Expected Behavior
The marketing consent checkbox is unticked by default (PRODUCT_NOTES §3: "The marketing consent box is
unticked by default."). Consent is recorded only when the visitor ticks it.

## Actual Behavior
The checkbox is rendered with the `checked` attribute:

```html
<input type="checkbox" name="consent" value="yes" checked>
<span>Yes, email me updates from Solace Avenue and Tidewave Music.</span>
```

Opt-ins submitted from this form are stored with `consent = t`.
For comparison, the campaign page form (`/campaigns/harmattan-sessions`, "Email me updates about this
campaign.") renders its consent checkbox unticked, as specified.

## Evidence
- Request / Response IDs:
  - `GET /artist/solace-avenue` → 200, `req_b818988324fb93d456` (form rendered pre-ticked)
  - `POST /optin` from artist page → 303, `req_c1dc838404482ebea4` → stored `opt_fd861bb23fa6559153`, `consent = t`
  - `POST /optin` from artist page → 303, `req_d9a4a2baede0b68cc9` → stored `opt_2cd9b3c38acdfb0512`, `consent = t`
- Logs or console output: HTML capture via curl in
  [`evidence/qa/F-02-F-03-optin-forms.txt`](../evidence/qa/F-02-F-03-optin-forms.txt)
- Screenshot / trace references:
  - Artist page, box pre-ticked: [`evidence/qa/F-02-artist-page-consent-prechecked.png`](../evidence/qa/F-02-artist-page-consent-prechecked.png)
  - Campaign page, box unticked (correct): [`evidence/qa/F-02-campaign-page-consent-unticked.png`](../evidence/qa/F-02-campaign-page-consent-unticked.png)
- Database query results (if applicable):

  ```sql
  select id, campaign_slug, source, consent, created_at from engine.optins order by created_at;
  ```
  ```
   opt_fd861bb23fa6559153 | coastline-ep | Artist | t | 2026-11-03 13:40:52+00
   opt_2cd9b3c38acdfb0512 | coastline-ep | Artist | t | 2026-11-03 13:41:37+00
  ```

## Notes
- Impact: consent that is pre-selected is not freely given; every artist-page opt-in is recorded as
  marketing consent and will trigger the intro email once event delivery works. Compliance/privacy risk.
- The two forms on the same journey behave differently (artist page pre-ticked, campaign page unticked),
  which points to a template default on the artist page rather than a shared component.
- Not yet verified: whether the engine rejects or ignores an opt-in submitted with the box unticked.
  Worth a follow-up test once this is fixed.
- Related: TW-002 (same opt-ins attached to the closed campaign).
