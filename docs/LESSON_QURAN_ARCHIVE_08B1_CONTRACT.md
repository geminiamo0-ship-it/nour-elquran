# Phase 08B1 — Sealed Quran lesson archives (read-only foundation) #192

**Source status:** branch until verified. **Do not claim any live Classroom teacher ink ingestion, browser visual acceptance or Production rollout.**

## Canonical data / provenance

- **No Quran content duplicate.** The edition is `hafs-kfqc:v1.1.1`, bound to an independently verified `quran_editions` row, and pages are always fetched by existing `ReaderPrintedPage` from the same versioned public Quran asset origin. Never generate/rewrite verses, page polygons or SVG.
- Additive D1 `0015_lesson_quran_archive.sql` plus hardening `0016_lesson_archive_required_fields.sql`: `lesson_quran_archives` draft→one-way sealed source envelope per `lesson_id + report_revision`, `lesson_quran_archive_pages` 1–20 explicit pages, `lesson_quran_archive_marks` <=100 per report snapshot. Annotation kinds `note/highlight/pen/marker`; references to existing verified `quran_ayah_anchors` for note/highlight and bounded ink coordinates for pen/marker. No voice/video or personal/student Quran notes copied here.
- Archive must refer to a **real completed lesson with matching authoritative END audit**, an **already published** teacher report of the same learner/revision, canonical Hafs edition and a source digest. D1 validates the end and publication lineage, immutable data and one-way seal. This is NOT proof the source SHA-256 represents a genuine Classroom DO export: the future DO ingestion service must authenticate its producer, verify its checkpoint digest, and seal only after fully writing its canonical snapshot. *No ingest/write/POST endpoint is exposed in this slice* and **no archive rows are manufactured** for real students.
- Future source-producer key trust, DO participant presence, ink streaming, staff corrections and report-archive reseal are **not implemented**; tracking under Classroom #120/#104 and separate Phase 08B2. A SQL synthetic test fixture may construct a source record for schema verification, never a Production document.

## Owner-only reader contract

`GET /v1/me/learners/:learnerId/lessons/:lessonId/quran-archive`:
- Requires signed Better Auth household owner, active target learner, completed audited lesson, version 0015 installed. Foreign account or sibling/lesson mismatch 404, unauthenticated 401, other methods 405.
- If no sealed archive for the **latest published report revision**, `{code:'ARCHIVE_NOT_SEALED',archive:null}` with HTTP 200. New *private draft* doesn't change latest published revision, so older approved archive remains visible; republishing a newer report without a matching new seal hides the old archive until new proof exists.
- Sealed `archive`: `{lessonId,learnerId,reportRevision,editionId,source:'classroom-do:v1',sourceSha256,sealedAtMs,pages:[1..604],marks:[{id,page,surah,ayah,kind,payload}]}`. No underlying private teacher draft, archived prior report, generalized private Mushaf state or audio. Owner reader imposes response bound and no-store through existing `reply`.
- Client strictly validates edition, page list uniqueness and order, mark scope and points before rendering using existing `ReaderPrintedPage` / `QuranInk` with `inkMode='off'`, including text note list and original highlight layer. No erase/edit access to original. Student free-text journal from 08A remains separate.
- PDF/PNG/export, R2 snapshot asset jobs, additional annotations, sharing/permissions and author verification for source producer remain unavailable. No fake downloads.

## Gates

1. SQLite `test_lesson_quran_archive.py`: missing END/published revision denial, canonical anchor and page FKs, malformed ink rejection, one-way seal, revision mismatch privacy and immutable row triggers.
2. Frontend typed parser tests, fast Verify TypeScript/build, native local Wrangler D1 and schema. Do not run Chrome on every PR.
3. Remote Cloudflare Dev **read-only** API/owner isolation (synthetic sealed fixture only after 0015 applied and Noor main checks) tracked separately in Santoreno; real Classroom / production remains separate.
4. Targeted mobile 360/390, desktop 1280, keyboard RTL and S Pen check needed for owner visual acceptance.

Rollback: revert UI/Worker route; keep additive D1 tables and source audit snapshots, never delete real published history. Admin Dashboard last under ADR 0008.
