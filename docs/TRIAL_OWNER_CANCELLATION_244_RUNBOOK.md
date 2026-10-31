# #244 — Signed guardian cancellation of scheduled trial (>=6 hours)

## Behavior
- Guarded POST `/v1/me/learners/:learnerId/trial-cancellations` accepts **only** `{operationId,lessonId}`, from verified Better Auth identity and active owner/child. The server and D1 both independently verify the lesson originated in a `trial_booking_events` record for **that exact learner**.
- A free 30m trial reserves a 40m slot. Guardian can cancel **at least six hours before** scheduled start while lesson is still `scheduled`. Student lesson page shows a two-step explicit cancellation confirmation only in that window. Outside that window the student is directed to the academy for an exception; nothing auto-cancels.
- New D1 0022 `trial_owner_cancellation_events` is immutable and idempotent. SQL trigger updates `lessons.status='cancelled'` (which also emits a genuine internal cancellation notice). No session debit, payment charge, compensation credit or fictional attendance verdict is generated.
- New bookings after migration use deterministic short-lived grant IDs plus immutable `trial_booking_auto_grants` provenance, so cancel revokes **only** the assignment created specifically for that booked trial. Existing teacher assignments that covered the slot are never revoked. This prevents a cancelled trial from leaving inappropriate future teacher access while preserving independent permissions.
- The old 0021 booking trigger is replaced in migration 0022; any Dev trial booking created before applying 0022 has no grant-mapping provenance and must be reviewed explicitly. **Never guess and revoke a historical teacher grant.**
- A cancelled trial doesn't consume the one-free-trial eligibility, so the learner can book a new free trial if a real open slot exists. The cancelled lesson stays in immutable history. A completed/live trial or an unexcused no-show still prevents automatic rebooking.
- UI only confirms cancellation after server ACK and refreshes the real signed lesson list. Network ambiguity requires reload; no optimistic cancellation.

## Cloudflare Dev release checklist
1. Apply D1 migrations through 0022, verify 0019 real inbox, 0021 trial slots and 0022 owner cancel all present.
2. Staff publishes trial slot; correct guardian books it, confirm exactly one auto-grant and one 40m scheduled lesson.
3. Guardian cancels >6h before start, ensure lesson cancelled and auto-grant revoked. Unrelated permanent grant must remain active; sibling cannot cancel.
4. Booking same slot after cancellation should succeed again subject to eligibility and availability. Cancel within 6h or in live state fails.
5. In two browser tabs/retry same operation UUID, one cancellation and one immutable history row; no debit/charge and no duplicate notification on replay.
6. Test guardian's Student lessons RTL/mobile, teacher schedule and lesson classroom, and staff exception workflow separately. No production rollout without actual two-account Dev proof.

## Open outside this PR
- Self-service reschedule is **not** implemented; user can cancel early and make another booking. Late cancellation exceptions, no-show staff review, paid lesson bundles and monthly renewals, manual payment reconciliation, approved WhatsApp reminders and admin-facing management pages remain open. No external provider interaction.
