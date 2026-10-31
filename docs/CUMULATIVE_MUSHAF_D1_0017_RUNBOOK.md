# #251 / A1 — additive D1 cumulative Mushaf ledger foundation

**Status:** implemented as a server-only schema/typed adapter and isolated tests. **NOT connected to live classroom, published task editor, or the browser**. Production and existing customer data are unchanged. Parent decision: [ADR 0009](adr/0009-unified-cumulative-learner-mushaf.md).

## What this slice adds

- `workers/api/migrations/0017_learner_quran_ledger.sql`:
  - immutable `learner_quran_events`, one operation id per learner, typed provenance (lesson/assignment/self-study), actor role and authenticated subject, verified Hafs edition/page, bounded payloads and verse/word validation;
  - `learner_quran_current` as a page-indexed current read projection, updated **atomically by the D1 event insert trigger**; changing/hiding a mark appends history instead of deleting it;
  - D1 guards for active owner/learner, qualified acting Sheikh during an actual live lesson, or currently assigned Sheikh and already published homework within the task's Qur'an range; cross-sibling and revoked grants are denied;
  - strict visibility: self-study belongs to `private`, approved classroom and published tasks are `shared`; teacher moderation may hide a learner's shared mark **during the same live lesson**, while author provenance remains unchanged.
- `workers/api/src/learner-quran-ledger.ts`: server-only typed parser, append helper with DB ACK, idempotency replay and permission recheck, owner composite read (new projection + existing private legacy read), teacher **shared-only** read. No public HTTP route; later route must derive `actor.subject` and `actor.role` from authenticated session, never the body.
- `workers/api/tests/test_learner_quran_ledger.py` uses real SQLite migrations and tests sibling/foreign denial, teacher vs learner in same lesson, moderation, End, published task bounds, revocation, validation, version conflict, no private backfill corruption. TypeScript unit tests pin no user-supplied actor data and strict private/shared separation.

## Crucial existing data preservation

Do NOT copy `private_mushaf_items` or `private_mushaf_events` into shared academic rows, and do NOT delete them. The new owner-only read combines **separate, correctly authorized existing private records** with the new academic projection until a tested migration is designed. Student private marks stay invisible to Sheikh, including when displayed alongside Sheikh marks in the student's Reader.

No historical classroom DO strokes are synthesized/backfilled in this slice. An approved DO exporter must authenticate source lesson/actor, preserve operation ids, verify D1 commit and reconnect, and reconcile from real durable DO state before any historical ingestion. A failed/unknown source must fail closed and never produce a fabricated mark.

## Gates still outstanding

1. **#251 A2:** route integration with verified Better Auth, strict ownership checks and direct local Wrangler signed API tests, canonical D1 checksum/source metadata, pagination/capacity, projection write protection, and proven backfill/reconciliation of old private+DO records without loss. Keep `#251` open until done.
2. **#252:** live Sheikh+learner ink write support in classroom DO, teacher moderation and *durable ordered DO→D1 outbox*; no optimistic global "saved" before canonical ACK, retry on queue outage and DO restart, no role spoofing, the existing LiveKit tests remain intact.
3. **#253:** teacher task-draft ink/markers/notes invisible until published; atomic task publication + global mark projection. Same `ReaderPrintedPage` and viewer cache used by Student Reader, study, teacher classroom and Notebook historical filtered view. Fix printed SVG and side list hiding simultaneously.
4. E2E staging proof: two siblings, multiple roles, revoked Sheikh, cancelled lesson, homework draft vs publication, report independence, NO duplication, mobile S Pen and five viewport sizes. NO Production release before independent rollout/restore approval.

## Roll-forward and rollback

Use *additive forward migrations only*. Apply to disposable local D1 before isolated Dev. No automatic migration or toggles are activated on Production. If newer API must be disabled, revert the API route and keep the append-only audit, never `DROP` or overwrite actual owner marks; this schema is designed to coexist with migration 0007/0015. Back up D1 and prove restore before real-user rollout.

## What must not be claimed

Green CI here certifies schema/typed-source and synthetic local behavior, **not** that live ink already appears in learner's ordinary Mushaf. That cross-surface integration is outstanding until #252/#253 and signed remote Dev evidence complete.
