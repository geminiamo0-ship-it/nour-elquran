# ADR 0004: Cloudflare-only Noor infrastructure

Date: 2026-10-29 (Africa/Cairo)  
Status: **accepted owner direction; individual integrations unverified**  
Tracking: [#104](https://github.com/geminiamo0-ship-it/nour-elquran/issues/104)  
Decision owner: product owner, explicit approval «خلاص هنعتمد على كلاود فلير بالكامل توكل على الله».

## Context
The frontend exists with explicit mock state; there is no Supabase production data to migrate. The owner chose Cloudflare after discussing the paid baseline, D1 relational fit and recovery. Replace the previous Supabase Auth/PostgreSQL/RLS design before implementing real data.

## Alternatives
- Keep Workers + Supabase: managed auth/Postgres/RLS, with a separate paid service.
- Cloudflare-only: Workers/D1/R2/DO/Queues and self-hosted application authentication; application authorization and SQLite-specific transaction design need deliberate engineering.
- External Postgres via Hyperdrive: available as a future option, but not the approved target.

## Decision
| Responsibility | Adopted target |
|---|---|
| API | Workers; all identity, role and learner authorization server-side |
| Relational source | D1 SQLite: accounts, learners, assignments, lessons, report revisions, credits, sharing and jobs |
| Authentication | Maintained library hosted in Workers with D1 persistence; Better Auth integration is evaluated in #46, not implemented by this ADR |
| Interactive lesson | SQLite-backed Lesson DO, durable operations/replay/outbox; do not create a DO for every table |
| Quran and private assets | Separate public canonical Quran and private R2 buckets |
| Background work | Durable outbox, Queues and Cron; duplicate-safe consumers |
| Frontend hosting | Current Next.js static export + Workers Static Assets configured in merged #105; #40 vinext verification applies before any SSR/runtime switch |
| Live audio/video | Cloudflare RealtimeKit target; #49/#50 must verify browser/mobile/reconnect and revocation before production |
| Recovery | D1 Time Travel plus private exports beyond retention; independent R2/DO recovery and reconciliation |

The infrastructure direction supersedes the Supabase/Postgres/RLS design and **the media-provider selection in ADR 0002 only**. Its approved shared-mushaf UX, annotations, archives, permissions and no-recording policy remain binding. RealtimeKit is not claimed provisioned or tested. No silent fallback to an external media provider.

D1 has no PostgreSQL RLS/GRANT model for application end users. There is no browser database token: Workers must check session/account/learner/role/resource/time on every operation. Do not invent a second login system; integrate the maintained auth library before enabling learner endpoints. Verification delivery (phone/email), WhatsApp and payments still require their respective providers; Cloudflare-only refers to hosted application infrastructure.

D1 batch is atomic on SQL failure. An UPDATE that affects zero rows is not automatically an error: CAS/constraint guards and all dependent writes must enforce the invariant within the same batch. No SELECT FOR UPDATE, no distributed D1/DO/R2 transaction, no authority derived from eventually consistent KV.

## Consequences
- Schema uses D1-supported SQLite, strict types, FK and ownership constraints. Money/publication operations require dedicated race/idempotency tests before implementing them.
- Keep one canonical Mushaf per learner, current publication projection, separate personal notes and immutable historical records.
- Paid D1: 10 GB maximum per database; included storage/pricing is a separate quota. Read/SQL throughput is measured, not unlimited.
- Workers Paid starts at $5/account/month with included allocations; it is not a $5 cap on the full platform. Media, notifications, storage and excess operations can add cost.
- Preserve old design/history as superseded; update implementation issues instead of leaving contradictory active Supabase instructions.
- New environments/resources must be Noor-specific and isolated. No secrets copied or unrelated existing resources changed.

## Verification and rollback
PR #107 was inspected as overlapping draft foundation work; this continuation consolidates its closed API intent, identity/FK test coverage and probe aliases with the complete notebook plan. Keep one active migration lineage, not both competing 0001 schemas.

CF-01 adds a local-only Worker scaffold, D1 migration and authorization/SQLite tests. Protected endpoints remain unavailable until real authentication; this is not completion of #46.
Run root lint/typecheck/test/build/smoke and exact-head GitHub Verify. Local SQLite tests prove constraints in SQLite, not Cloudflare runtime, account permissions, PITR or A/V. Add actual D1/Worker staging tests and restore rehearsal before data is accepted.
No production deployment/restore is included. Application rollback reverts code or disables the affected feature; migrations use expand/contract and no destructive rollback.

## Official references (checked 2026-10-29)
- [D1 binding and batch semantics](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
- [D1 SQL and strict tables](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [RealtimeKit](https://developers.cloudflare.com/realtime/realtimekit/)
