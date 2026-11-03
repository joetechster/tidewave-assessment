# Leads Service Code Review and PR-17 Review

**Scope**: `leads-service/` as of commit `e485a5c` (before the Section D template fix), plus open PR `pull-requests/PR-17`.  
**Method**: read every source file, then checked each finding against the running service
(`http://localhost:7081`) or the database. Live results are in
[`evidence/qa/leads/CR-live-checks.txt`](../evidence/qa/leads/CR-live-checks.txt); the PR-17 migration
dry run is in [`evidence/qa/leads/PR-17-migration-dry-run.txt`](../evidence/qa/leads/PR-17-migration-dry-run.txt).  
**Status key**: **Verified live** = reproduced against the running service. **Code only** = found by
reading, not reproduced; stated as a risk.

---

## Summary

| ID | Severity | Type | Finding | Status |
|---|---|---|---|---|
| CR-01 | High | Security | Viewer token can change lead status; route meant to be admin-only | Verified live |
| CR-02 | High | Logic | API accepts status `active`, which product rules forbid | Verified live |
| CR-03 | High | Scoring | Score of exactly 70 gets `needs_review` instead of `screening_invite` | Verified live |
| CR-04 | Medium | Logic | Duplicate check is case/whitespace sensitive and ignores phone format | Verified live |
| CR-05 | Medium | Validation | Non-numeric experience/hours cause 500; negative and impossible values accepted | Verified live |
| CR-06 | Medium | Reliability | `lead.created` sent before the insert, not awaited, no outbox or retry | Code only |
| CR-07 | Medium | Concurrency | Check-then-insert duplicate detection has no lock or unique constraint | Code only (race not reproduced) |
| CR-08 | Medium | Logic | Missing template variables render as the text `undefined` | Code only (fixed in `ade4282`) |
| CR-09 | Low | Security | Template key from the URL is joined into a file path (path traversal) | Verified live |
| CR-10 | Low | Logic | Draft templates can be rendered through the API | Verified live |
| CR-11 | Medium | Security | Hard-coded fallback tokens and signing secret in `config.ts` | Code only |
| CR-12 | Medium | Ops | All migrations re-run on every start; start continues after a failed migration | Code only |
| CR-13 | Low | Security | Token comparison is not constant-time | Code only |
| CR-14 | Low | Security | Tools reset returns raw database error text | Code only |

**PR-17: Request changes.** The migration fails on the seed data, would delete a consent-withdrawal record,
and does not fix the duplicate the PR describes. Details below.

---

## Findings

### CR-01 (High, security): viewer can change lead status
- **Where**: [`src/routes/leads.ts:246`](../leads-service/src/routes/leads.ts#L246). The route comment says
  "staff admin only" but it uses `requireStaff`, which admits `staff.viewer`. `requireAdmin` exists in
  [`src/auth.ts:62`](../leads-service/src/auth.ts#L62) and is never used.
- **Proof**: `PATCH /leads/lead_seed_10/status` with the viewer token returned **200** and changed the lead.
- **Also**: the activity row for the change records `actor: "system"`
  ([`leads.ts:282`](../leads-service/src/routes/leads.ts#L282), same at line 315), so the audit trail cannot
  show who made the change.
- **Fix**: use `requireAdmin`; store `req.user.role` (or a user id) as the activity actor.

### CR-02 (High, business rule): status `active` is allowed
- **Where**: [`leads.ts:249`](../leads-service/src/routes/leads.ts#L249) `allowedStatuses` includes `'active'`.
- **Rule**: PRODUCT_NOTES §2: "The system never marks anyone hired, active or field ready."
- **Proof**: `PATCH … {"status":"active"}` with the admin token returned **200**, `status: "active"`.
- **Fix**: allow only `screening_invite`, `needs_review`, `not_now`, `duplicate`.

### CR-03 (High, scoring): boundary at 70 is wrong
- **Where**: [`src/scoring.ts:44`](../leads-service/src/scoring.ts#L44) `if (score > 70)`.
- **Rule**: PRODUCT_NOTES §2: "score ≥ 70 → `screening_invite`".
- **Proof**: application with 3 years (40) + 15 h (20) + Ibadan (10) = 70 was created as **`needs_review`**.
  Seed leads `lead_seed_04` and `lead_seed_05` (score 70) are also stored as `needs_review`.
- **Why tests missed it**: [`test/scoring.test.ts`](../leads-service/test/scoring.test.ts) only checks 85, 60
  and 40; no boundary values.
- **Fix**: `score >= 70`; add tests for 70, 69, 50 and 49.

### CR-04 (Medium, logic): duplicate detection misses the same person
- **Where**: [`leads.ts:51-57`](../leads-service/src/routes/leads.ts#L51-L57) compares `email = $1` exactly and
  `phone = $2` exactly. Neither value is normalised on write.
- **Rule**: PRODUCT_NOTES §2: same person → `duplicate`; "The same person must not get two follow-up emails
  for one application."
- **Proof**: `Case.<n>@Mail.test` then `case.<n>@mail.test` both got `duplicateOf: null`, and **two follow-up
  emails were sent** (Mailpit list in the evidence file). Seed data shows the same problem:
  `lead_seed_01` `"Kemi.Adeyemi@Mail.test "` (capitals and trailing space) and `lead_seed_02`
  `kemi.adeyemi@mail.test` with the same phone are both `screening_invite`; `lead_seed_03`/`04` share a phone
  written as `+2348031234567` and `08031234567`.
- **Fix**: normalise on write and compare (trim + lowercase email; phone to E.164), backed by a unique index.

### CR-05 (Medium, validation): numeric fields not validated
- **Where**: [`leads.ts:16-17`](../leads-service/src/routes/leads.ts#L16-L17)
  `z.union([z.number(), z.string()])` accepts any string or number.
- **Proof**: `experienceYears: "three"` → **500 Internal server error** (scoring treats it as 0, then the
  `NUMERIC` insert fails). `experienceYears: -2, hoursPerWeek: 500` → **201**, scored and stored.
- **Fix**: `z.coerce.number().int().min(0).max(…)` for both; invalid input returns 422 like the other fields.

### CR-06 (Medium, reliability): event sent before the lead exists
- **Where**: [`leads.ts:108-119`](../leads-service/src/routes/leads.ts#L108-L119) calls `sendLeadCreatedEvent`
  without `await`, **before** the insert at line 130. [`src/events.ts:43-46`](../leads-service/src/events.ts#L43-L46)
  only logs delivery failures. The `leads.event_outbox` table exists in `001_init.sql` but is never written.
- **Risk**: if the insert fails, n8n receives `lead.created` for a lead that does not exist; if n8n is down the
  event is lost with no retry (matches the brief's hint that events do not always arrive).
- **Not reproduced**: for the CR-05 request that returned 500, no email reached Mailpit, so the downstream effect
  was not observed. Stated as a code-level risk.
- **Fix**: insert the lead and an outbox row in one transaction; deliver from the outbox with retries.

### CR-07 (Medium, concurrency): duplicate check is not atomic
- **Where**: [`leads.ts:51-130`](../leads-service/src/routes/leads.ts#L51-L130) reads, then inserts, with no
  transaction and no unique constraint.
- **Not reproduced**: two parallel identical requests were correctly split (one `duplicate`). The window is
  small but real under load; a unique index on the normalised email (CR-04) closes it.

### CR-08 (Medium, logic): missing variables print "undefined"
- **Where**: `src/templates.ts:92-95` as of `e485a5c`:
  `variables[v.name] !== undefined ? variables[v.name] : '' + variables[v.name]` yields the string
  `"undefined"`, so `{{firstName}}` renders "Hi undefined," and `{{#if}}` fallbacks never trigger.
- **Status**: fixed in commit `ade4282` (`safeValue`); regression covered by
  `playwright/tests/api/templates.spec.ts` ("missing variables fall back instead of rendering \"undefined\"").
  The running container was rebuilt with that change, so it cannot be shown live.

### CR-09 (Low, security): template path traversal
- **Where**: [`src/templates.ts`](../leads-service/src/templates.ts) `renderTemplate`, `path.join(dir, \`${key}.json\`)` with
  `key` from the URL.
- **Proof**: `POST /templates/..%2Ftemplates%2Fsolace-intro/render` returned **200**, so `../` segments are
  followed. Impact is limited (needs a `.json` and `.html` with the same name, staff/automation token).
- **Fix**: accept only keys returned by `listTemplates()` (or `^[a-z0-9-]+$`).

### CR-10 (Low): draft templates render
- `POST /templates/old-promo-draft/render` returned **200**. The render endpoint should refuse
  `status: "draft"` so automation cannot send drafts.

### CR-11 (Medium, security): hard-coded secrets
- [`src/config.ts:5-10`](../leads-service/src/config.ts#L5-L10) falls back to fixed admin, viewer, automation and
  tools tokens and the event signing secret; `leads-service/README.md` prints them. A deployment that forgets an
  env var runs with publicly known credentials. **Fix**: fail fast when they are missing.

### CR-12 (Medium, ops): migrations re-run every start
- [`src/migrations.ts`](../leads-service/src/migrations.ts) executes every `.sql` file on every start with no
  record of what already ran; [`src/index.ts:10-13`](../leads-service/src/index.ts#L10-L13) starts the server even
  when a migration fails. The seed is re-applied on every boot, and any destructive migration (see PR-17) would
  run on every restart. **Fix**: a migrations table; stop on failure.

### CR-13 / CR-14 (Low)
- [`auth.ts:33-40`](../leads-service/src/auth.ts#L33-L40) compares tokens with `===`; use
  `crypto.timingSafeEqual`.
- [`src/routes/tools.ts:27`](../leads-service/src/routes/tools.ts#L27) returns `err.message` to the caller.

### Related observation (n8n, Section B, not leads code)
During the CR checks the `street-team-lead` workflow emailed a score-100 test applicant
"You're now an active Tidewave rep!" (Mailpit list in the evidence file). That breaks the "never active" rule;
tracked for the Section B workflow fix.

---

## PR-17 review: "Fix duplicate leads"

**Decision: Request changes.**

| # | Severity | Problem | Proof |
|---|---|---|---|
| 1 | Blocker | The migration **fails on the current data**. Deleting the older Tayo row (`lead_seed_13`) violates `leads_duplicate_of_fkey`, because `lead_seed_14.duplicate_of` points to it. | Dry run (rolled back): `ERROR: update or delete on table "leads" violates foreign key constraint "leads_duplicate_of_fkey" … Key (id)=(lead_seed_13)` |
| 2 | Blocker | Combined with CR-12 the failing migration runs on **every start**, and startup continues past the error. If it ever succeeded it would delete again on every restart. | `migrations.ts`, `index.ts:10-13` |
| 3 | Blocker | It **deletes the consent-withdrawal record**. `lead_seed_06` (Sola, `consent_withdrawn = true`) is targeted because a later application exists. That row is the evidence that consent was withdrawn; PRODUCT_NOTES says the later application is a new lead, not a duplicate. | Preview query in the dry run lists `lead_seed_06` |
| 4 | High | It keeps the **newest** row and deletes the original, the opposite of the app's model (the first application is canonical; later ones point to it with `duplicate_of`). Survivors would be `duplicate` rows pointing at nothing. | `leads.ts:63-70` |
| 5 | High | Irreversible `DELETE` of leads **and their activity history** with no backup, no soft-delete and no rollback plan. Destroys the audit trail. | Migration SQL |
| 6 | High | It **does not fix the case in the description**. `LOWER()` without `TRIM()` does not match `"Kemi.Adeyemi@Mail.test "` (trailing space) to `kemi.adeyemi@mail.test`, so the Kemi duplicate in the seed survives. | Dry run: Kemi rows not targeted |
| 7 | Medium | Phone is still compared exactly (`+2348031234567` vs `08031234567`), and the migration only matches on email while the app matches email **or** phone. | `lead_seed_03`/`04` |
| 8 | Medium | No tests added; the race in CR-07 remains; `LOWER(email)` without a matching index forces a full scan. `email.toLowerCase()` is redundant next to `LOWER($1)`. | Diff |
| 9 | Low | "Fixes the duplicate issue once and for all" overstates the change. | PR description |

**What would make it mergeable**
1. Drop the deleting migration. If old duplicates must be handled, **mark** them (`status = 'duplicate'`,
   `duplicate_of = <oldest id>`) in a transaction, skip rows with `consent_withdrawn = true`, and keep activity.
2. Normalise on write (`trim().toLowerCase()` email, E.164 phone), and add a unique index on the normalised
   email for non-duplicate, non-withdrawn rows.
3. Add tests: mixed case, trailing spaces, phone formats, withdrawn consent, two parallel submissions.
4. Add a migrations table (CR-12) before shipping any data migration.
