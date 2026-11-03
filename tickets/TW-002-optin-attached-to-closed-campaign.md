# TW-002: Opt-ins are attached to the closed campaign `coastline-ep`

**Area**: Engine  
**Severity**: High  
**Environment**: Starter build, Persona: ada  
**Retest Status**: Open  

---

## Summary
Listener opt-ins are stored and emitted with `campaign_slug = coastline-ep`, which is the closed Coastline EP
campaign. This happens even when the opt-in is submitted from the active Harmattan Sessions campaign page.
The `optin.created` event carries the same slug, so the intro email (which links the listener to the
campaign page) would point at a campaign that can no longer be backed.

## Steps to Reproduce
1. Log in at `http://localhost:7080/login` as `ada` / `listen123`.
2. Open `http://localhost:7080/campaigns/harmattan-sessions`.
3. Under "Not ready to back?", enter First name `ada`, Email `ada@mail.test`, tick "Email me updates about this campaign.", click "Keep me posted".
4. As `qa_reader`, run:
   ```sql
   select id, campaign_slug, source, consent, created_at from engine.optins order by created_at desc limit 1;
   select id, payload from engine.outbox where type = 'optin.created' order by created_at desc limit 1;
   select slug, title, is_open from engine.campaigns;
   ```

## Expected Behavior
An opt-in made from the Harmattan Sessions campaign page is attached to `harmattan-sessions`, the active
campaign (PRODUCT_NOTES §4: "Active campaign: Harmattan Sessions"). The listener's intro email links to a
campaign page from which they "may choose to back the campaign" (PRODUCT_NOTES §3).
An opt-in from the artist page should likewise attach to the open campaign, not a closed one.

## Actual Behavior
The opt-in is stored with `campaign_slug = coastline-ep` (`is_open = f`), and the emitted event payload contains
`"campaignSlug":"coastline-ep"`. Artist page opt-ins are attached to `coastline-ep` as well.

Neither form sends a campaign field (the campaign page form only sends a hidden `from=campaign`), so the
engine selects the campaign server-side and selects the closed one.

## Evidence
- Request / Response IDs:
  - Campaign page: `POST /optin` → 303, `req_218157b1a39d1d0530` (2026-11-03 13:46:12Z), redirected to
    `GET /campaigns/harmattan-sessions?optin=1`, `req_2f2871ab82d108a084` → stored `opt_858a4e135d13866fe4`,
    event `evt_82735f99a71b2fd354`
  - Artist page: `POST /optin` → 303, `req_c1dc838404482ebea4` → `opt_fd861bb23fa6559153`, event `evt_7f39ed5c685bbaf4c8`
  - Artist page: `POST /optin` → 303, `req_d9a4a2baede0b68cc9` → `opt_2cd9b3c38acdfb0512`, event `evt_2c554c25a45b90ab9a`
- Logs or console output: request log, form HTML and query output in
  [`evidence/qa/F-02-F-03-optin-forms.txt`](../evidence/qa/F-02-F-03-optin-forms.txt) and
  [`evidence/qa/F-01-optin-events-not-delivered.txt`](../evidence/qa/F-01-optin-events-not-delivered.txt)
- Screenshot / trace references: campaign page form used for the repro:
  [`evidence/qa/F-02-campaign-page-consent-unticked.png`](../evidence/qa/F-02-campaign-page-consent-unticked.png)
- Database query results (if applicable):
  ```
  engine.optins
   opt_fd861bb23fa6559153 | coastline-ep | Artist | t | 2026-11-03 13:40:52+00
   opt_2cd9b3c38acdfb0512 | coastline-ep | Artist | t | 2026-11-03 13:41:37+00
   opt_858a4e135d13866fe4 | coastline-ep | artist | t | 2026-11-03 13:46:12+00

  engine.outbox (evt_82735f99a71b2fd354 payload)
   {"data":{"artistSlug":"solace-avenue","campaignSlug":"coastline-ep","consent":true,
    "email":"ada@mail.test","firstName":"ada","participantId":"","source":"artist"},
    "id":"evt_82735f99a71b2fd354","sequence":1,"type":"optin.created"}

  engine.campaigns
   harmattan-sessions | Harmattan Sessions | t
   coastline-ep       | Coastline EP       | f
  ```

## Notes
- Root cause hypothesis: the engine resolves the opt-in's campaign from the artist (e.g. first/oldest campaign
  for `solace-avenue`) without filtering on `is_open`, and ignores which page the form was submitted from.
- Impact on downstream automation: any workflow building the intro email link from `campaignSlug` sends
  listeners to the closed Coastline EP page, breaking the listener → backer journey.
- The intro email itself could not be observed because `optin.created` events are not currently delivered to
  n8n (engine `n8nEventsUrl` points at `/webhook-test/`, tracked under Section B, investigation log F-01).
  The wrong slug is proven from the stored opt-in and the event payload.
- Related observations (not part of this ticket): `participantId` is empty although the request actor is
  `participant:ada`; `source` is `"Artist"` from the artist page and `"artist"` from the campaign page.
- Related: TW-001 (same artist-page opt-ins recorded with pre-ticked consent).
