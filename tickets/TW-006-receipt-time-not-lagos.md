# TW-006: Receipts show UTC time instead of Lagos time (wrong date near midnight)

**Area**: Engine / Public Website  
**Severity**: Medium  
**Environment**: Starter build, Persona: ada  
**Retest Status**: Open  

---

## Summary
Receipt dates and times are printed in UTC. The product notes require Lagos date and time (WAT, UTC+1).
Every receipt is one hour behind, and payments made between 23:00 and 23:59 UTC show the previous
calendar day.

## Steps to Reproduce
1. Log in to `http://localhost:7080` as `ada` / `listen123` and open one of your receipts
   (`/me/receipts/<receipt_no>`), noting the "Date" row.
2. As `qa_reader`: `select receipt_no, created_at from engine.payments where receipt_no = <receipt_no>;`
3. Compare the receipt time with `created_at` converted to WAT (UTC+1).
4. Seed receipt 1003 shows the date effect (it is visible to any participant because of TW-005).

## Expected Behavior
Receipts show Lagos date and time, WAT (UTC+1) (PRODUCT_NOTES PR9). A payment at
2026-10-29 23:20 UTC shows **30 Oct 2026, 00:20**.

## Actual Behavior

| Receipt | `created_at` (UTC) | Expected (WAT) | Shown |
|---|---|---|---|
| 1007 (ada) | 2026-11-03 14:27:21 | 3 Nov 2026, 15:27 | 3 Nov 2026, 14:27 |
| 1001 | 2026-10-25 14:25:24 | 25 Oct 2026, 15:25 | 25 Oct 2026, 14:25 |
| 1003 | 2026-10-29 23:20:00 | **30 Oct 2026, 00:20** | **29 Oct 2026, 23:20** |

The checkout quote page does convert correctly: a quote requested at 14:27:12 UTC
(`req_2ea6789f8173358c50`) showed "Quote valid until 15:57 (Lagos)" (30 minutes later, in WAT). So only the
receipt rendering is wrong.

## Evidence
- Request / Response IDs: GET `/me/receipts/1003` as ada `req_dbeb39c180a0a26455`;
  GET `/me/receipts/1001` `req_f3e36e24c11b1e6188`
- Logs or console output: [`evidence/qa/F-08-receipt-time-not-lagos.txt`](../evidence/qa/F-08-receipt-time-not-lagos.txt)
- Screenshot / trace references: [`evidence/qa/F-05-F-08-receipt-1003-as-ada.jpg`](../evidence/qa/F-05-F-08-receipt-1003-as-ada.jpg)
  (shows "29 Oct 2026, 23:20")
- Database query results (if applicable): `created_at` values in the evidence file and in
  [`evidence/qa/F-05-receipts-other-participants.txt`](../evidence/qa/F-05-receipts-other-participants.txt).

## Notes
- The engine container runs with `TZ=UTC` (docker-compose), so formatting with the server's local time
  gives UTC. Formatting with an explicit `Africa/Lagos` time zone fixes it regardless of server TZ.
- Impact: wrong dates on financial receipts near midnight; receipts disagree with the quote page.
- Not checked: whether `/me` history or emails share the same formatting.
