# TW-005: Any logged-in participant can open every other participant's receipt

**Area**: Engine / Public Website  
**Severity**: Critical  
**Environment**: Starter build, Persona: ada  
**Retest Status**: Open  

---

## Summary
`/me/receipts/{receipt_no}` returns any receipt to any logged-in participant. Receipt numbers are
sequential (1001, 1002, …), so a participant can walk the range and read every backer's full name,
email address, amount, currency, status and payment reference. The product notes require that a
participant can only see their own receipts.

## Steps to Reproduce
1. Log in to `http://localhost:7080` as `ada` / `listen123`.
2. Open `http://localhost:7080/me/receipts/1001`.
3. Repeat for `1002` … `1006`.
4. As `qa_reader`, confirm who owns each receipt:
   `select p.receipt_no, l.participant_id from engine.payments p left join engine.ledger l on l.payment_id = p.id order by 1;`

## Expected Behavior
A participant can only see their own receipts (PRODUCT_NOTES PR12). Requesting another participant's
receipt returns 404 (or 403) and shows no personal data.

## Actual Behavior
Every request returns 200 with the other backer's details. None of 1001–1006 belong to ada:

| Receipt | Owner | Shown to ada |
|---|---|---|
| 1001 | `par_bayo_626179` | Bayo Adeleke, bayo.adeleke@example.test, ₦6,150.00, succeeded |
| 1002 | `par_awa_617761` | Awa Diallo, awa.diallo@example.test, CFA 6,663, succeeded |
| 1003 | `par_tunde_74756e` | Tunde Bakare, tunde.bakare@example.test, ₦10,250.00, succeeded |
| 1004 | `par_zara_7a6172` | Zara Okafor, zara.okafor@example.test, ₦12,300.00, refunded |
| 1005 | `par_lola_6c6f6c` | Lola Peters, lola.peters@example.test, ₦10,250.00, succeeded |
| 1006 | (failed payment, no ledger row) | Dayo Cole, dayo.cole@example.test, $7.07, failed |

## Evidence
- Request / Response IDs (GET as ada, all 200): 1001 `req_f3e36e24c11b1e6188`, 1002 `req_8cdfcfde46d64add98`,
  1003 `req_dbeb39c180a0a26455`, 1004 `req_e4337e9c1f9a1c2292`, 1005 `req_973a29736f918baae3`,
  1006 `req_7eab0cddd2a46880bc`
- Logs or console output: [`evidence/qa/F-05-receipts-other-participants.txt`](../evidence/qa/F-05-receipts-other-participants.txt)
  (owner query and the page text of each receipt)
- Screenshot / trace references: receipt 1003 (Tunde's) open in ada's session:
  [`evidence/qa/F-05-F-08-receipt-1003-as-ada.jpg`](../evidence/qa/F-05-F-08-receipt-1003-as-ada.jpg)
- Database query results (if applicable): owner table in the evidence file above.

## Notes
- Impact: personal data (name, email) and payment details of every backer are exposed to any account.
  Sequential receipt numbers make enumeration trivial. Privacy / data-protection incident.
- Root cause hypothesis: the receipt route looks the payment up by `receipt_no` without checking that it
  belongs to the session participant.
- Suggested fix: scope the lookup to the logged-in participant and return 404 otherwise; consider
  non-guessable receipt identifiers in URLs.
- Not tested: whether a logged-out visitor can open receipts (the route is under `/me`, so it likely
  redirects to login).
