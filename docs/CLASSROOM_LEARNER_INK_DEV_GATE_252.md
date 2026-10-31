# #252 — Signed learner classroom ink (staged, off-by-default)

## Scope (2026-10-31)
The authenticated Student Classroom **now has POST** `/v1/me/learners/:learnerId/lessons/:lessonId/quran-ink`, and the Sheikh's existing POST is constrained to the same durable-write gate. Both may add pen/marker and hide their own strokes; the verified Sheikh may moderate shared marks. The teacher alone controls the shared page. Student siblings and non-assigned teachers cannot use each other's lesson route.

Both GET snapshot routes contain an optional **server-derived** `canWrite: boolean` (never browser-supplied). It is true only if the verified D1 lesson is `live` and `NOOR_CUMULATIVE_INK_ENABLED==='true'`. The frontend disables the pen/marker/eraser for both roles until a signed GET confirms permission and the lifecycle reports `live`. On GET failure or page switch, permission drops to false. POST rechecks the signed role and D1 lesson and refuses writes while the durable flag is OFF (503) or lesson is not live (409). The DO also rechecks lease, D1 authority, current page, revision, and End fence; no browser actor subject is accepted.

### Source behavior and caveats

- Server's 202 `INK_PENDING_PERSISTENCE` is **not** a permanent save. A verified 200 saved write ACK is required, and pending outbox blocks End. An ambiguous network failure is reported as **unconfirmed**, then snapshots reconcile. The fix for misleading historical snapshot `saved` messages is independently tracked in PR #268.
- Flag OFF means **no live editing** from either signed portal; this intentionally prevents new non-canonical room-only marks. Old pre-gate DO marks require separate reconciliation/backfill and are NOT deemed canonical.
- Student can erase only marks they authored; teacher can hide any shared classroom mark. The UI currently does not pre-filter foreign marks in the eraser, but D1/DO rejects unauthorized hide without mutating state.
- Existing student private self-study notes remain private; adding shared classroom ink is a distinct, explicit live user action.
- Does not add a new public D1 write route, deploy, or enable production, nor certify real LiveKit media or device stylus success.

## Safe staged acceptance (required before enabling learner drawing)

1. In Dev only, run D1 migration 0017 and verify proper enrollment, signed guardian and qualified acting Sheikh, and a real **scheduled** lesson. Keep `NOOR_CUMULATIVE_INK_ENABLED` unset while checking GET `canWrite:false` and POST rejection without an ink row.
2. Explicitly enable the gate **only on staging** after review. Both users join the same lesson from their actual accounts. With `scheduled` status, GET `canWrite:false`; Sheikh starts the lesson via signed Start.
3. Once `live`, verify both GETs advertise `canWrite:true`; teacher adds a gold marker, student adds a blue pen, student removes own blue pen; student cannot remove teacher marker; teacher can moderate the student mark. Test concurrent revision conflict, 2 tabs, and role/revocation changes.
4. Check D1 `learner_quran_events` source events and the **owner-only** signed cumulative Quran endpoint reflect both authorized authors and hide actions. Refresh both live rooms; reopen the student's printed Quran. Check another sibling receives 404 and cannot see the ink.
5. With D1 unavailable, verify 202 pending vs 200 saved, outbox replay on DO restart, and blocked lesson End until ledger has caught up. After End, all write routes reject; Notebook and Reader retain approved historic/cumulative marks.
6. Test Android 360/390 layouts, S Pen draw/erase, live camera priority, real teacher and learner browser identities. **This was not run in this PR.** Log verified results and rollback plan in #252 before any production enablement.

## Rollback
Turn `NOOR_CUMULATIVE_INK_ENABLED` OFF and disable editing. Retain D1/DO state; **never delete** pending or archived events. Check outbox and End reconciliations with a safe maintenance procedure before re-enabling. This code does not change production config.
