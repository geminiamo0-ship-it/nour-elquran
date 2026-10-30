# ADR 0009 — Single cumulative learner Mushaf across the entire Noor platform

- **Status:** Accepted by product owner, 2026-10-31; **implementation pending**
- **Tracking:** [Epic #250](https://github.com/geminiamo0-ship-it/nour-elquran/issues/250), [master #155](https://github.com/geminiamo0-ship-it/nour-elquran/issues/155), [archive #248](https://github.com/geminiamo0-ship-it/nour-elquran/issues/248), [portal #242](https://github.com/geminiamo0-ship-it/nour-elquran/issues/242)
- **Authority:** Supersedes any older suggestions of distinct student-vs-teacher Quran copies or a duplicated per-lesson Mushaf. The Quran's verified Hafs page assets remain immutable and shared; **educational annotations are uniquely learner-scoped and cumulative**.

## Context and owner's requested experience

The Sheikh and learner annotate Quran pages together in a lesson. These edits are *not* an isolated lesson-only canvas. The same student's Mushaf must show them immediately after durable commit and in future lessons, personal reading, assigned memorization/revision training and the lesson Notebook. If the Sheikh subsequently adds verse notes, ink or highlights while preparing a task, those approved additions also become part of that same cumulative Mushaf when the task is published. Learners must never need to open an old lesson just to see marks already written on their Quran.

For example, the teacher highlights Al-Mulk 3 and comments on Al-Mulk 4 in L1. Learner views those two marks in the everyday Reader the following day. Teacher publishes memorization task Al-Mulk 1–5 and revision Al-Haqqah 1–10, with another teacher annotation. The student sees all appropriate marks in both homework training and personal Reader, as well as the next live lesson. The L1 Notebook can still reconstruct *which changes came from L1* rather than falsely attributing later homework marks to L1.

## Decision

**Exactly one canonical learner annotation history plus read projection** across all surfaces, keyed to `learner_id` and verified `edition_id`. Never clone the 604 page text/SVG; page art is immutable canonical R2 content. Do not create independent page-annotation stores for homework vs classroom vs Notebook. The word *layer* means an ACL/filter over one ledger, not a separate Mushaf.

1. **Origins, identity, scope.** Each accepted event has `annotation_id`, `operation_id`, `learner_id`, verified `edition_id`, `page`, `surah/ayah/word_index?` for verse-bound types, normalized ink coordinates, `kind`, validated bounded payload, `actor_subject`, `actor_role`, `origin_type=lesson|assignment|self_study`, `origin_id?`, `visibility=learner_private|shared_approved|teacher_draft`, revision, time, and optional `supersedes_event_id`. **Never trust caller-supplied role or tenant.**
2. **Durable write and provenance.** The authorized Worker validates assignment/lesson/user/teacher grants, D1/Quran anchors and payload; all accepted writes are an append-only idempotent operation and derived current projection. A client shows saved only after the authoritative commit/ACK. A DO-based live session may use a durable ordered outbox, and must expose delivery pending/failed until the canonical ledger catches up. DO event generation does not silently imply a successful permanent save.
3. **Collaborative live lesson.** Both authentic Sheikh and learner may draw/mark according to configured tools, and the Sheikh can moderate/hide visible learner ink. Authorized shared edits are visible in the room and the canonical Mushaf once ACKed, **even before a lesson report is approved**. An unpublished teacher *report draft* remains private; do not conflate a visible live highlight with a report publication. On End, flush/preserve outstanding canonical events, replay safely across retries and DO restarts. Revoking a substitute's assignment stops future writes but does not erase accepted prior marks.
4. **Homework teacher annotations.** Draft task annotation set is teacher-only. **Publishing the task** simultaneously (or with fail-closed, recoverable transactional outbox) publishes its validated marks into the learner's canonical history. The learner never sees unapproved homework editing. A new task revision appends history, never silently alters an earlier sealed snapshot.
5. **Learner private notes.** Student self-study marks are a private visibility class inside the same underlying learner ledger or an auditable migrated private stream. The learner sees them in the composite Quran; the Sheikh does **not** gain read access just because the learner marked the same verse in the classroom. Explicit sharing requires a separate consent + grant event.
6. **Views.** The personal Reader, homework memorization/revision, preparation, connected live classroom and Notebook all use the same `ReaderPrintedPage` renderer, page polygons and authoritative authorized annotation read service. UI can filter teacher / my marks / all / this activity. No one-time copied JSX or screenshot masquerading as canonical page data.
7. **Notebook is a query, not a second Quran.** Notebook historical view is immutable per lesson/report version or an as-of projection, with `origin_type='lesson'` and `origin_id=lesson_id`. It can show original ink, corrected/retracted version and author audit, and jump to today's cumulative page. This historical view is not the source of current state, and MUST NOT mutate old events. Existing `lesson_quran_archives` read-only schema remains useful for independently verifiable sealed proofs, but ingestion must be from trusted canonical ledger / DO checkpoint, never synthesized from a client.
8. **Hide-to-memorize is presentation-only.** In training, conceal the actual printed SVG verse polygons **and** verse-by-verse text list. Also conceal any annotations, hints or accessibility labels that give away the answer. Never write a hide action to the annotation ledger; reveal/reset only in local training state. If polygon metadata is unavailable, fail closed and disable the test.
9. **Retention and audit.** Undo/hide is a new event; never silently delete provenance. Snapshot/compaction preserves integrity and history. Note visibility/ACL filters are server-enforced. Owner's family child B cannot read child A data, even on a shared account.

## Current implementation and architectural gap (verified 2026-10-31)

- Private student D1 store: `0007_private_mushaf.sql`, `private-mushaf.ts`, `usePrivateMushafSave.ts`; strict owner-only GET/POST, versioned idempotent events. It is **not** a shared teacher/lesson store.
- Classroom DO: `classroom/quran-ink.ts`, `classroom/ink-sync.ts`, `classroom/lesson-room.ts`; stores per-lesson ink; as of this decision **teacher-only add/hide**, learner snapshot read. It does **not** feed the student's permanent Mushaf. This must change under explicit teacher moderation and actor auditing.
- Homework: `published-assignments.ts` and `TeacherConnectedAssignments.tsx` assign text and Quran ranges, but no task-level teacher marker editor or publish-linked marks yet.
- Notebook: `0015_lesson_quran_archive.sql`, `0016_lesson_archive_required_fields.sql`, `lesson-quran-archive.ts` only read sealed existing records. Trusted snapshot ingestion is **not** currently implemented.
- Client study test: `TrainingQuranSession.tsx` hides only verse-list text, not SVG printed page; must be fixed as an independent gate.

## Implementation order and safety gates

**A. Contract + migration.** Design additive D1 `learner_quran_annotation_events`, current projection and scope-index (possibly bridge existing private events without deleting or rewriting them). Authorization checks must cover verified learner, authentic teacher assignment and whether an active lesson/task exists, validated Quran anchors, bounded body, idempotency and CAS. Model same-id replays, business versioning, backfill and trusted migration/roll-back. DO vs D1 eventual consistency and outage strategy explicit.

**B. Live room integration.** Enable learner-authorized ink writes with teacher moderation and source identities; ordered durable DO→D1 outbox or equivalent. Prove no lost ACKed edits under restart/queue outage/reconnect and role revocation; report publication stays independently gated.

**C. Assignment editing and publication.** Sheikh mark/note/draw on verified Quran page for selected learner and the exact memorization/revision range, keep draft private, publish atomically with task status, invalidate composite reader cache, conflict/retry protections.

**D. Unified client + Notebook.** All entry points share typed read API and renderer with origin filters, save/retry/error states, correct 360/390 mobile sizing, optional author toggles and a lesson history as-of read. The person's private marks are still visible only to the owner.

**E. Real Dev acceptance.** Two learner siblings, teacher active/revoked, signed live dual participant sessions, two tasks, annotated lesson + new homework + private self-study, same page visible from all surfaces after reload, historical L1 unchanged by later edits, no cross-account data exposure; idempotency/restart/outbox failure; phones (360/390) and desktop (1280); no mock seeds on live routes. Full stage pass *before* Production.

## Non-goals / exclusions

Not an audio recorder, no voice uploads or use of children's media; separate #245. No payment/booking functionality from this ADR; separate #244. Not a promise of immediate Production release. No changing scripture assets or generating synthetic verse geometry. No exposing teacher drafts or the learner's private notes to the other party without explicit authorization.

## Done means

A learner can annotate with the Sheikh in L1, see exactly those committed notes in the normal Mushaf, next live lesson and homework, inspect only L1 changes in the Notebook, then receive newly published task notes globally without overwriting their private marks. An unrelated sibling never sees them. All data persists across reloads and verified retries. **Documenting this decision is not implementation.**
