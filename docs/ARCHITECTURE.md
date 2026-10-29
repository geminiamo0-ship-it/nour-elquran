# Architecture — Cloudflare-only owner-approved target

Decision: 2026-10-29 Cairo, [#104](https://github.com/geminiamo0-ship-it/nour-elquran/issues/104), [ADR 0004](adr/0004-cloudflare-only-platform.md). Supersedes prior Supabase/Postgres/RLS and LiveKit provider topology; shared Quran product behavior remains unchanged.

| Boundary | Authority |
|---|---|
| Browser / Next.js | Presentation only; no database/admin credentials; no trusted client role or learner ID |
| Workers API | Real session verification, account/learner/resource/time authorization, validated use cases |
| Auth library on Workers | Account sessions backed by D1; #46 integration still pending |
| D1 | Authoritative relational identity, lessons, publication pointers, assignments, permissions and credit ledger |
| Lesson DO SQLite | Authorized hot lesson state, durable sequence/ACK/replay and outbox; no unrelated DO per CRUD table |
| R2 | Canonical public Quran assets separate from private snapshots/audio/exports |
| Queues/Cron | Outbox-backed duplicate-safe jobs, stale-event rejection and provider reconciliation |
| RealtimeKit | Cloudflare media target after #49/#50 verification; no default live recording |
| Frontend Workers hosting | #40 verifies vinext compatibility before cutover; existing Next.js/native components preserved |

## Source of truth
Accounts and learners are distinct. Family owner may access authorized learner profiles intentionally; restricted child sessions need server-enforced scope. Canonical Quran is immutable and versioned. One learner Mushaf accumulates current approved lesson layers; notebook filters by lesson and current published revision. Personal notes stay private until deliberate selected sharing.

D1 batch transactions must enforce write invariants through actual SQL failures/conditional guards and affected-row checks. Zero-row UPDATE is not a rollback. No PostgreSQL RLS/GRANT/SELECT FOR UPDATE assumptions. Database bindings are server-only; no raw SQL endpoint. Constraints supplement, not replace, application authorization.

No distributed transaction across D1, DO and R2. Seal/verify snapshot before publication; atomically commit publication pointer/approved layers/outbox in D1. R2 artifacts and notifications are recoverable derivatives. Stateful lesson operations remain durable in DO and reconcile by event/version, not blind copies.

## Implemented in CF-01 vs future
CF-01 includes local-only Workers health/fail-closed API boundary, pure read/report permission helpers, strict D1 migration and tests. No functioning auth/registration, native D1/DO runtime proof, remote resources, live lesson, persistent student frontend, payment or WhatsApp is claimed. See [worker README](../workers/api/README.md).

Next exact backend task: #46 maintained auth integration, actual isolated staging bindings, D1 native SQL/authorization tests and session revocation. Existing notebook #102 continues the approved frontend work. #49/#50 and #40 must supply actual media/hosting evidence.

## Recovery / cost
Use [backup runbook](CLOUDFLARE_BACKUP_AND_RESTORE.md): D1 Time Travel + longer private exports, R2 object recovery and DO replay/reconciliation. Restore is whole-DB and needs operational controls; no restore has run here.
Workers Paid starts at $5 per account with included usage, not a cap on all services. D1 maximum 10GB/database differs from included storage. Observe actual consumption and acceptance capacity before launch.
