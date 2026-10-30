# Phase 08B2 — Trusted LessonDO archive checkpoint contract (#194)

**Status: source-only validation and SHA-256 helpers; NO actual Lesson Durable Object, shared ink transport, archive writer, D1 seal, Dev deployment, PDF/PNG or Production.** Follow-up to the accepted read-only #192/08B1. Admin Dashboard remains last.

## Checkpoint v1

Pure server module: workers/api/src/classroom/archive-checkpoint.ts. Input is an **already persisted and independently authenticated DO snapshot**, never a browser request. parseArchiveCheckpoint(input, expectedScope) checks runtime data against the D1-resolved lesson, learner, acting teacher, canonical edition and independently loaded edition manifest_sha256. The helper cannot establish those facts by itself.

- Required exact top-level keys: schemaVersion=1, lessonId, learnerId, actingTeacherId, editionId, manifestSha256, startedAtMs, endedAtMs, pages, marks.
- pages: sorted ascending, unique canonical 1–604, at least one and at most 20. marks: at most 100, preserving original **strictly increasing** DO event sequence and unique event IDs; gaps are allowed for non-archive DO events.
- Each mark records original event ID, sequence, event time within verified lesson interval, teacher role and ID, page, kind and normalized payload. Only teacher-authored note, highlight, pen, marker can be exported; **student-private ink and arbitrary classroom messages are excluded**. The DO must prove author identity from authenticated room membership, not from a supplied authorRole string.
- Note/highlight must have surah+ayah; canonical (edition,surah,ayah,page) is independently checked by D1 quran_ayah_anchors before insert. Ink must have null anchors, color, width 1–60 and 2–2500 normalized coordinates (x 0–1000, y 0–1594). No Quran text, SVG, voice or video is embedded.
- Strict runtime bounds: 20 pages, 100 marks, 110,000 UTF-8 bytes per mark payload, 512 KiB normalized snapshot; malformed/extra keys, NaN, replay, reorder, wrong household/lesson/teacher/edition/manifest, student marks and timestamp mismatches fail closed.
- Canonical digest is lowercase SHA-256 of UTF-8 JSON.stringify(parseArchiveCheckpoint(...)) with **fixed field order** and lowercase hex colors. verifyArchiveCheckpoint recomputes and compares the digest. Any future writer must use these same normalized bytes; hash equality is **integrity, not proof of DO identity or an authoritative END**.

## Required future trust chain (not implemented)

1. Signed Better Auth acting Sheikh + active, lesson-scoped primary/substitute grant and genuine two-person DO presence; server-side checks on every WS/command. No public archive POST or client role assertion.
2. Durable SQLite event log with stable monotonic sequence, ACK, idempotent append and outbox. Teacher End must commit authoritative D1 END audit and checkpoint intention without pretending D1/DO form a distributed transaction; retries reconcile by event/checkpoint ID after restart/outage.
3. Internal authenticated service binding receives the DO-produced checkpoint. Resolve expected scope and canonical manifest SHA from D1; validate bytes/digest and each anchor; link to actual END audit and **already published** report revision. One immutable D1 0015/0016 archive per report revision; never edit a sealed version. A corrected report needs a new immutable archive version and a verified snapshot.
4. Only seal after all pages/marks and source digest are independently checked; on failure keep draft hidden from owner reader. Test true two-participant exchange, disconnect/reconnect, duplicate/reordered events, revoked/expired substitute, cross-household 404, DO/D1/Queue/R2 outage and report revision changes on isolated Dev.
5. Private PDF/PNG/R2 export and child audio remain **disabled** until separate privacy, retention and signed-access approval. Targeted Chrome/mobile/S Pen validation after the actual Classroom producer exists.

## Verification and rollback

Run: node --experimental-strip-types --test workers/api/tests/archive-checkpoint.test.ts. Tests cover deterministic digest, tampering, role/scope, replay, ordering, page and payload bounds. Root fast Verify also runs strict TypeScript and backend Node tests. **Passing tests prove only the pure contract, not Classroom/DO presence or archive creation.**

Rollback: remove the unused module/tests without touching D1 0015/0016 or existing read-only owner archive endpoint. Keep #194 OPEN until real trusted DO exporter, authenticated internal writer, restart/outage recovery and Dev E2E evidence exist.
