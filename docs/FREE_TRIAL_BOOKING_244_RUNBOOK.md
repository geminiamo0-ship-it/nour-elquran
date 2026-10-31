# #244 — First real free trial: Staff-open slots, owner auto assignment, D1 transaction

## Contract
- Each learner profile may have **one currently scheduled/live/completed non-cancelled trial**. If a staff-authorized six-hour advance cancellation is saved in D1, a new trial may be booked. Late no-show is not automatically cancelled; unexcused no-show rebooking requires a separate staff exception policy.
- An explicitly qualified/verified staff member first publishes one 40m open slot for an active qualified Sheikh via POST `/v1/staff/trial-slots` with `{operationId,teacherId,startsAtMs}`. Slot ends at +2,400,000ms, valid for 30 days, no overlapping published slots for same Sheikh. Private teacher identity is **not** exposed through guardian availability.
- Verified owner of exact active learner uses GET `/v1/me/learners/:id/trial-slots`. Slots show only opaque slotId, Cairo-local UI time, and `instructionMinutes:30,reservationMinutes:40`; excludes teacher/child conflicts, revoked/disabled Sheikh, withdrawn slots. No prices/payments/balances invented.
- Owner POST `/v1/me/learners/:id/trial-bookings` with **only** `{operationId,slotId}`. D1 `trial_booking_events` BEFORE trigger checks authenticated owner/active child, approved open slot, once-per-profile trial entitlement, teacher+learner occupancy, teacher-assignment conflict, and future horizon. Its AFTER trigger **atomically** records teacher assignment when needed plus scheduled 40m trial lesson and derived inbox notices. D1 conflicts roll back everything; no partial booking.
- Reuse of a once-used slot follows actual remaining capacity, not a boolean held by the browser. Late repeat/no-show cannot silently obtain a new free trial. Already-cancelled trial may be rebooked by the same verified child.
- Staff may withdraw an advertised future slot via POST `/v1/staff/trial-slots/:slotId/close`, with `{operationId,reason}`, immutable audit, verified staff authority. Withdrawing a slot **does not** cancel an already-booked lesson.
- Student `/student/lessons` mounts signed `StudentTrialBooking` with real available slots and no fixture. A single click requests the booking; the UI waits for server ACK and refreshes the actual lesson list. Ambiguous network failure requires a fresh read, not a new operationId or invented success.

## Not yet production-ready
- Slot opening and staff cancellations currently require signed staff APIs; there is no admin staff GUI yet.
- No monthly packs, payments, paid entitlement/reservation limits, automated teacher schedule generator, guardian WhatsApp consent/OTP, 24h+1h reminders, credits/debits or compensations. These stay separate issue #244/#247.
- No staff exception for a late no-show; no self-service cancel/reschedule UI yet. Staff schedule's existing >=6h cancellation gate applies; no automatic override.
- No real Cloudflare Dev 2-account and concurrency acceptance yet, no confirmed remote D1 schema install, no Production flag change or deployment performed by this PR.

## Dev acceptance
1. On isolated Dev D1, apply migration 0021; verify staff permissions, teacher qualification and all owned-learner scopes. Publish two adjacent staff slots, verify 30m lesson UI and 40m authoritative reservation.
2. Two separate accounts race to book the same slot; exactly one D1 transaction succeeds. Other gets 409. Teacher schedule and guardian lessons show one signed trial.
3. Same child retries same operationId -> 200 with exact same lesson ID; different op or child-sibling impersonation denied.
4. Staff >=6h advance cancellation marks original lesson cancelled, then original child may rebook, but completed/live trial or unexcused no-show cannot rebook automatically.
5. Withdraw not-yet-booked future slot; it must disappear from GET and fail POST, while previously booked lessons remain unchanged.
6. Reload and switch siblings; ensure no cross-child slots/eligibility or fake payments. Check device UX after integration and before Production.

## Rollback
Keep immutable event history and avoid deletion; hide staging booking UI/revert Worker code if needed. Do not silently delete scheduled lessons or the associated teacher assignment.
