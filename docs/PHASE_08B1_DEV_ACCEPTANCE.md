# Phase 08B1 — Exact Cloudflare Dev acceptance (2026-10-30)

This document supersedes the original *source-only* status in the initial #192 implementation contract **only for the signed API/D1 read-only gate**.

## Evidence

- **Noor source**: [PR #193](https://github.com/geminiamo0-ship-it/nour-elquran/pull/193) merged to `5ac9561d4db957b605d609e9ab4677a5c92375c7`. Exact merged main [Verify #40990456089](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40990456089) **SUCCESS 4/4** (repository, governance, code quality/SQLite TypeScript, native Cloudflare D1/Better Auth).
- **Santoreno staging**: [PR #261](https://github.com/geminiamo0-ship-it/santoreno/pull/261) merged `f320a4b7e90e201179e7a9eca432af73073c304d`. [Isolated real Cloudflare Dev #40990589139](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40990589139) **SUCCESS**: current Noor main checked, additive D1 migrations 0015/0016, connected UI built and deployed to existing Noor staging Worker. Signed synthetic approved lesson + report, account-owner GET archive returned `200 {archive:null,code:'ARCHIVE_NOT_SEALED'}`; unrelated owner `404`, anonymous `401`, mutation POST `405`; no synthetic archive marks created in Dev. Older 07A report + 08A private-note regression smoke passed, no Production services.
- **Local SQLite evidence**: tests in `workers/api/tests/test_lesson_quran_archive.py` construct **only local memory** synthetic END+published report and archival marks, proving canonical anchor/page FKs, provenance gating, latest published revision, one-way immutability and missing/null payload rejection. No forged pages or marks were inserted into remote Dev.

## What is still NOT delivered

1. Classroom Durable Object trusted snapshot producer, real two-participant attendance and live teacher pen/marker event ingestion, independent checkpoint SHA-256 verification and exact sealing are **NOT implemented**. Nothing in the remote PASS proves they are.
2. No real archived teacher marks are shown because there is **no trusted producer**. The Student UI explicitly shows unavailable, not invented sample content.
3. Targeted mobile/RTL/keyboard/pointer/S Pen owner visual acceptance remains open. Default Chrome tests are intentionally off.
4. PDF/PNG export and private R2/download lifecycle, sharing, audio/guardian consent, Admin Dashboard/teacher invitations/payments and Production deployment are separate unfinished tasks.

## Next actual implementation

- [Issue #194](https://github.com/geminiamo0-ship-it/nour-elquran/issues/194): verified Classroom DO checkpoint export, source-to-D1 ingestion with integrity/ACL and idempotency/retry, then teacher-archive display in the shared Quran renderer.
- This closes **only the Phase 08B1 read-only D1/API Dev security gate**. Parent #192 should stay open for visual/provenance integration, #102/#155 remain open. Admin Dashboard last (ADR 0008).

**Rollback:** revert new read-only API/UI code if needed, preserve immutable source tables and archive journal. Never delete real learner records or backfill fabricated Quran/lesson material.
