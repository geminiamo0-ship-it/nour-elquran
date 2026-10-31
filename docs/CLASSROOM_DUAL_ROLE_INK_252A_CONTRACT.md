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
