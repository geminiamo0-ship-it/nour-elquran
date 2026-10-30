# Phase 08A — Connected lesson notebook private notes (#190)

**Status:** source branch only. No Dev D1 migration, real HTTP acceptance, verified browser UX, R2 snapshot or Production claim.

## Ownership and data separation

- `0007_private_mushaf.sql` remains the **single** home for private Quran/ayah pen, marker, highlight and positional annotations. The new note records are free-text **lesson journal entries**, not duplicate Quran ink/annotations.
- `0014_notebook_private_notes.sql`: `notebook_note_events` immutable append-only operation journal and `notebook_private_notes` visible/revisioned projection. `lesson_id+learner_id` FK ensures note belongs to the right learner's actual lesson. Each note is owned by the current Better Auth household account and no Sheikh or other household may read/write it. All writes require a completed lesson with authoritative END audit, not only `status=completed`.
- A single household manages sibling profiles but each note request explicitly authorizes the *requested learner* and lesson against D1. No parent/guardian identity assumption for audio or teaching authorization.
- Student notebook reads real completed lessons from existing `GET /v1/me/learners/:id/lessons`, approved latest-only reports from Phase 07A `GET /v1/me/learners/:id/reports`. All trial/standard/makeup lesson kinds are supported. A lesson without published report stays `report pending`, not an invented assessment.
- The archive, approved lesson Quran layers, PDF/PNG files, Quran anchor jumps and sharing **remain unavailable** until Classroom snapshot and privacy/export contracts are implemented and verified; no fake download links.

## New owner-only routes

`GET /v1/me/learners/:learnerId/lessons/:lessonId/notebook-notes` → `{notes:[{id,body,version,updatedAtMs}]}` capped 100, only visible notes for that completed audited lesson.

`POST` same path with exact `{action:'put'|'hide',operationId:UUIDv4,noteId:UUIDv4,expectedVersion:number,body:string}`. `put` (1–500 chars, trim) creates at `expectedVersion:0` or edits existing with CAS; `hide` requires an existing visible note and empty body. No hard delete from event log. Success returns note ID/version; identical command replay returns 200 `NOTEBOOK_ALREADY_APPLIED`, stale CAS or conflicting reused UUID returns 409. Any identity/lesson mismatch is 404, never an owner disclosure. CORS/same-origin and signed Better Auth follow existing auth router.

## Release gates

1. Fast Node/parser + Python SQLite tests: sibling/foreign/Sheikh misuse, incomplete/mismatched lesson, invalid body, revision race, repeat operation, immutable journal.
2. Exact-head GitHub Verify, then isolated dedicated Cloudflare Dev D1 migration 0014 and signed synthetic owner/teacher/foreign GET/POST/read after refresh, including report pending and published states. Never Production or real learner data.
3. Targeted connected Notebook/Progress RTL mobile and desktop UI, once on owner request; don't run default Chrome on every commit.
4. Phase 08B Classroom owner-approved Quran snapshot/lesson layers and R2/PDF are separate, as are Admin booking/subscription and teacher onboarding.

Rollback: disable new API/UI and revert Worker code; keep D1 additive tables and immutable audit data. See ADR 0008 for Admin LAST.
