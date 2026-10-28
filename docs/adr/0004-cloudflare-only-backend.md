# ADR 0004 — Cloudflare-only backend foundation

**Date:** 2026-10-29 (Africa/Cairo)  
**Status:** Accepted target architecture; runtime integrations pending validation  
**Decision:** Owner approval in [Issue #104](https://github.com/geminiamo0-ship-it/nour-elquran/issues/104) supersedes Supabase Auth/PostgreSQL/RLS and LiveKit assumptions in older planning documents.

## Decision and boundaries

Keep the React/Next.js feature-first frontend. The Next.js/vinext adapter is **not** production-approved until #40 passes actual Workers runtime tests. Backend target: Cloudflare Workers as API boundary, D1 as relational system of record, Durable Objects with SQLite for per-lesson interactive state where measured/needed, private R2 for authorized assets, Queues/Cron for outbox and reminders. Evaluate Cloudflare RealtimeKit for two-person A/V under #49; do not imply it is provisioned or production-ready. Workers/DO must not proxy A/V media.

Account identity is not learner identity. One adult account may own multiple independent learner profiles. All authorization is server-side: verify a signed session with an approved issuer, derive account identity from verified claims, check active grants/learner ownership, scope every D1 read/write, and use server-side idempotency for writes. **D1 does not have PostgreSQL RLS.** Composite FKs prevent cross-learner reference mismatches but cannot establish actor authorization, teacher qualifications, substitute expiry, payment correctness or publication policy by themselves.

## First code slice

`workers/api/src/index.ts` has only liveness/readiness and a fail-closed `/v1` boundary. No auth provider, signed sessions or protected data API yet. `workers/api/migrations/0001_core_identity_lessons.sql` is a replayable **empty-schema** D1 migration with accounts, learner profiles, teacher qualifications/assignments, lessons and annotation event ownership constraints. Unit tests exercise forged identity, no DB binding, failure redaction, foreign keys, duplicate operations, JSON and invalid lesson references. This is local verification, **not a deployed Worker or D1 migration**.

## Data, recovery and cost

D1 Time Travel has a bounded window (Free up to 7 days, Paid up to 30 days; verify actual plan and current provider limits before reliance). It is **not** a replacement for independently encrypted, access-controlled exports with retention longer than that window and regular restore rehearsals. R2 objects, DO SQLite and Queue messages are **not** automatically restored as one consistent D1 snapshot. Document versioned snapshots, outbox replay and cross-service reconciliation before launch. No paid service or Cloudflare resource is provisioned by this ADR.

Proposed environment isolation: names such as `noor-dev`, `noor-staging`, `noor-production` are labels only, not created resources. Obtain explicit account/binding identifiers from authorized settings rather than inventing IDs. D1 constraints and indexed read paths need staging query and concurrent booking benchmarks; D1/DO cannot be treated as a distributed transaction. Financial and booking invariants require a dedicated atomic design and failure tests.

## Rollout gates

1. #46: choose and verify secure account/session issuer, implement login and role/profile authorization tests. Never accept client-supplied learner ID as permission.
2. Provision isolated dev D1 with approved bindings; apply migration and verify `PRAGMA foreign_key_check`, recovery and migrations on actual D1.
3. #40: Workers runtime and vinext integration tests, SSR/cookies/R2 bindings; record measured compatibility.
4. #87/#49/#50: real-time ownership, authorized annotations, RealtimeKit A/V evaluation and private archive.
5. #47/#53/#54: booking, ledger and reminders with idempotent workflows and reconciliation.
6. #56: backups/restore, audit, minors' consent, performance, security and production signoff.

**Rollback:** no production deployment in this PR; revert application files before merge or disable unshipped route afterward. Never perform destructive D1 schema rollback on live records. Older ADR 0002 and plan #101 remain historical and must be marked superseded/updated before their implementation PRs merge.
