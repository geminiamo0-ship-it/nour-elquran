# #252B — DO room ink to canonical D1 (Dev-only acceptance)

This tranche wires the **live DO ink write** to the existing `0017_learner_quran_ledger.sql` canonical event API. It does **not** enable public learner POST or the learner toolbar; it does **not** update Production.

## Write and ACK boundaries
1. Signed Worker access + existing room lease; D1 lesson phase must be `live`.
2. Validate a page command and CAS revision. Atomically commit `quranInk:<page>`, `pendingQuranInk` and the retry alarm in the same SQLite-backed Durable Object transaction. Queue limit is 64; overflow blocks new ink rather than deleting pending events.
3. Flush the oldest pending event through `appendQuranLedgerEvent` with its original verified actor, learner, origin and first-accepted timestamp. Only `QURAN_EVENT_COMMITTED` or identical `QURAN_EVENT_REPLAY` authorizes removal from the DO outbox.
4. DO crash after D1 commit but before outbox removal is recovered by replaying the same deterministic operation ID. D1 outage, permission revocation, duplicate conflicts and invalid event data **retain** the pending operation for reconciliation.
5. A write returns `INK_APPLIED`/`INK_REPLAY` only when the pending DO queue is empty; otherwise it returns HTTP 503 `INK_SAVE_PENDING`. Do not use DO snapshot / visible strokes as evidence of durable canonical save.
6. DO alarm retries while the queue is nonempty. The external Worker End path sends `prepare` to the same room, flushes before an atomic no-pending writer fence, then executes D1 lifecycle End. D1 End failure asks the DO to release; successful End marks the fence complete. The D1 lesson status is re-checked for new writes to reject late strokes if an End callback is lost.

## Acceptance checks before rollout
- CI: backend TS typecheck, Node tests, real SQLite/D1 migration tests, app build and architecture policies. No production data or credentials.
- Dev with synthetic teacher and learner in two browsers: add/hide moderation, causal authorship, verified D1 canonical learner page read after ACK; room restart during pending write; simulate D1 unavailable and recovery, duplicate replay without double insert; reject new stroke after End and reject End while pending.
- Check 360/390 mobile and 1280 desktop only after secure signed learner POST + explicit pending UI is ready. **Do not enable learner drawing based only on this Backend PR.**
- Outstanding: signed learner POST/UI, global Reader/Notebook projection, archive/backfill of legacy room records, teacher task mark publication, Stage Dev remote QA. #250/#251/#252/#253 stay open.

## Known safety boundary
A D1 event repeatedly rejected by authoritative revocation/constraint does not disappear: subsequent End stays blocked. Investigate grants, origin, and immutable audit rather than silently deleting the queued mark. Recovery/reconciliation tooling and on-device offline operation queue remain separate follow-up gates; do not assert offline client persistence.
