# Product Notes — Tidewave Music

This document describes the business rules, user journeys, and technical policies for Tidewave Music systems.

---

## 1. Overview
Tidewave Music operates two primary programs:
1. **Tidewave Street Team**: A field representative outreach network for local music promotion.
2. **Artist Campaigns (Solace Avenue)**: Crowdfunding and direct listener engagement for independent releases.

---

## 2. Street Team Lead Intake

Applying is not a job offer. The system never marks anyone hired, active or field ready.

### Scoring and Lead Rules
- **score** = experience points (0 y = 0, 1–2 y = 20, 3+ y = 40) + availability (<10 h/week = 0, 10–19 = 20, 20+ = 30) + city (Lagos, Abuja, Accra, Kumasi = 30; other = 10)
- **status:** score ≥ 70 → `screening_invite`; 50–69 → `needs_review`; < 50 → `not_now`; same person already exists → `duplicate` (with `duplicateOf`)
- **Required:** firstName, email, phone, city, consent=true; otherwise 422
- **Never** `active`, `hired`, `field_ready`

### Additional Operating Rules
- Hours per week are counted in whole hours, rounded down.
- If someone withdrew consent, a later application is a new lead, not a duplicate.
- The same person must not get two follow-up emails for one application.

---

## 3. Solace Avenue Listener Journey

A visitor hears a track preview on the artist page. They may choose to opt in by submitting their name and email address. The marketing consent box is unticked by default.

Upon opt-in, the listener receives an intro email containing a direct link to the campaign page. From the campaign page, the listener may choose to back the campaign.

Backing is voluntary. It is not employment and not an investment.

---

## 4. Payment Rules (PR1 – PR14)

- **PR1**: Prices are set in NGN. Other currencies use the rate snapshot shown on the quote. A quote is locked for 30 minutes.
- **PR2**: Converted prices are always rounded UP to the currency's smallest unit, so the payer never falls short.
- **PR3**: XOF has no decimal places.
- **PR4**: A backing counts toward a level only when FakePay confirms it (`succeeded`). Pending or processing never counts.
- **PR5**: The fee is 2.5% (minimum ₦100 or equivalent). It is shown separately and is not part of the backing total.
- **PR6**: Instalments are allowed: any amount of at least ₦1,000 or equivalent. Levels use the sum of confirmed backings.
- **PR7**: A pending payment expires after 30 minutes. If FakePay later confirms an expired payment, it must still be credited, because the money was taken.
- **PR8**: History shows the amount actually paid, in the currency paid. It never changes later.
- **PR9**: Receipts show Lagos date and time (WAT, UTC+1).
- **PR10**: Referral credit is 5% of the friend's confirmed backing (fee excluded), at most ₦2,000 per referrer per campaign, held for 7 days. There is no credit for your own backing.
- **PR11**: A refund removes the backing from the total (the level can go down) and cancels referral credit that is still on hold.
- **PR12**: A participant can only see their own receipts.
- **PR13**: Only admins can refund.
- **PR14**: The "You're in" message appears only after confirmation.

### Backing Levels
Backing levels depend on the total confirmed backing on a campaign:
- **Listener**: ≥ ₦2,000 (or currency equivalent)
- **Supporter**: ≥ ₦10,000 (or currency equivalent)
- **Patron**: ≥ ₦50,000 (or currency equivalent)

Supported currencies: **NGN**, **USD**, **GHS**, **XOF**.

### Campaigns
- Active campaign: **Harmattan Sessions** (`harmattan-sessions`)
- Closed campaign: **Coastline EP** (`coastline-ep`)
