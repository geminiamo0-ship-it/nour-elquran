# Phase #252-A — shared classroom ink provenance and moderation (source-only)

**Status:** staged backend infrastructure. This change is **NOT a completion of #252** and does NOT activate learner drawing in the authenticated browser. Canonical D1 projection from the room is pending.

## Scope

- `classroom/quran-ink.ts` stores every lesson stroke with the authenticated writer's `author=teacher|learner` and signed `subject`. The teacher no longer owns all strokes by definition.
- `parseInkCommand` accepts carefully bounded learner stroke/add and hide commands **only when the trusted Worker passes a verified learner identity and the DO validates the active room lease**. A student cannot erase a teacher's or another student's stroke. A qualified Sheikh in the verified room can moderate a learner's shared mark; original author provenance remains.
- `classroom/ink-sync.ts` allows the strict internal role-specific command shape without accepting caller-supplied role/learner/actor. Existing public learner `quran-ink` API remains **GET-only**. Existing student UI pen/eraser stays **disabled** until a durable bridge to the cumulative learner D1 ledger is complete.
- Existing Teacher POST and per-room snapshot are unchanged. The DO ink operation still ACKs *room durability only*, not a global permanent annotation.

## Current blockers before enabling learner writing

1. DO operations must create immutable signed-origin append-only entries in the D1 `0017_learner_quran_ledger`. Use a durable bounded ordered DO outbox and deterministic UUID operation IDs derived from verified room actions, then retry until D1 ACK; the API must not invent permanent success.
2. Do not lose pending events on lesson END. Teacher lifecycle END must drain/reconcile the outbox first or fail closed and resume safely. Replays after a completed lesson need a strictly authenticated historical source path, not a weakened general client grant.
3. Fail closed on unauthorized/stale room lease, revoked Sheikh, incorrect learner, wrong live lesson, capacity conflicts and D1 outages. Do not expose student-private self-study notes to the Sheikh.
4. Only after native two-signed-actor Dev tests, connect learner POST in `auth/routes.ts`, enable client toolbar/eraser with appropriately scoped controls and exact contributor messaging, and add archived Notebook views.
5. Source QA: dual-role authorship on durable DO state, user-only erase, teacher moderation, tampered identity rejection, replay under DO restart, old teacher behavior unchanged.

Owner-approved context: [ADR 0009](adr/0009-unified-cumulative-learner-mushaf.md), Epic #250, #251 canonical ledger, #252 live bridge, #253 unified reader/homework/Notebook. No Production change.

## A2 — deterministic canonical D1 delivery contract (pending DO integration)
- `classroom/ink-cumulative-outbox.ts` converts an already Worker-verified / DO-lease-checked room add/hide to **the existing #251 D1 event command**, with a deterministic valid UUID from trusted lesson+learner+actor+source request ID, and a separate stable item ID from learner+lesson+stroke ID. Distinct lesson IDs never alias the same cumulative item. Hiding uses the same item ID and revision 1; teacher moderation keeps the original creation record author unchanged.
- Events include the authentic actor role, child ID, lesson ID, original bounded pen/marker payload and accepted timestamp. `queueCumulativeInk` models a strict in-order, at-most-64, never-evict-unacked pending ledger; replay of the same op keeps its first accepted time, a conflicting payload is rejected, and overflow blocks new acceptance rather than dropping acknowledged marks.
- **Not yet connected:** no write to actual DO storage, D1 publisher, retry/alarm, or lifecycle End gate is enabled in this slice. This pure bridge cannot itself guarantee durability. DO storage + atomic enqueue and authenticated canonical flush still require implementation; until then learner POST/toolbar remain closed. Do not call this a successfully persisted annotation.

## A3 — transactional DO outbox + canonical D1 delivery (2026-10-31)
- Feature flag **`NOOR_CUMULATIVE_INK_ENABLED='true'`** (intentionally unset by default). No new browser learner POST permission in this change. Enable in controlled Dev only after signed two-role tests and verification of edge cases.
- When enabled, an actively authorized, verified teacher/learner stroke/hide is first checked against D1 and the current live room lease. Its in-room stroke and canonical outbox delivery entry are written **within one DO storage transaction**. Full queue rejects new writes with no partial local ink.
- The DO tries the next D1 `learner_quran_events` append immediately, deleting the pending delivery **only after** the trusted ledger returns `QURAN_EVENT_COMMITTED` or `QURAN_EVENT_REPLAY`. A DO alarm retries in FIFO order after DB outage/reboot; never reorder hide before add. A replay after successful insert cannot double count.
- A failed immediate D1 append returns `HTTP 202 / INK_PENDING_PERSISTENCE`, not `INK_APPLIED` presented as a final saved mark. Signed page snapshots carry `persistence=pending|saved` so the classroom continues to warn while any canonical write is outstanding. The printed Mushaf in unrelated surfaces does not claim to show the pending mark.
- Teacher End checks a Worker-signed `/internal/quran-ink-end-fence` DO handler: it attempts to flush, checks the remaining outbox, and atomically marks the lesson's ink writing as closed. Concurrent draws then return conflict. If writes remain pending, End returns `409 QURAN_INK_PENDING` and the D1 lesson remains live.
- The existing D1 guard still requires `status='live'`; accepted queued operations must flush before End. If D1 completion fails after fence, retrying End is allowed but live ink remains closed to prevent a gap. An explicit administrative recovery/re-open plan is required before enabling for real classes.
- Existing legacy un-gated teacher ink flow remains intact; no production/staging environment flag was changed. **Do not mistake this flag-gated implementation for a completed rollout.**
- Sources: `workers/api/src/classroom/lesson-room.ts`, `quran-ink-end-fence.ts`, `learner-quran-ledger.ts`; regression `tests/classroom-cumulative-delivery.test.ts` verifies outage, pending, reboot alarm, committed replay, End blocking and no partial ink. Do not enable on Production until native Wrangler signed E2E and lesson-end/race QA have passed.
