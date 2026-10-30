## Dev runtime verification — API gate passed (2026-10-30)
- Source [Noor #187](https://github.com/geminiamo0-ship-it/nour-elquran/pull/187) merged to `fedc03a8aa89e04a8080e5210840a93bf900027c`, postmerge [Verify #40986308630](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40986308630) 4/4 PASS.
- Real isolated [Cloudflare Dev #40986426733](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40986426733) SUCCESS on Santoreno `4b267a852401a527699084b3e8357642b5a54a98`. D1 0013 migration, deployed API, synthetic signed authorized teacher, explicit **test-only** Start/End audit, draft/publish/replay/CAS, student latest-only, foreign/anon 404/401 and revoke teacher denial; legacy staging regressions PASS.
- Still pending: owner target UI/RTL/mobile acceptance, real Classroom DO two-person presence + End event, snapshot/archive linking, notifications and Production. No Chrome run in default workflow. This Dev test does not constitute production readiness.

# Noor Phase 07A — Completed lesson report contract (#186)

**Status:** isolated Cloudflare Dev API/D1 acceptance verified; UI visual QA, real Classroom and Production remain pending. Parent #155 and CORE-13 #51 stay open.

## What is authoritative

- D1 migration `0013_lesson_reports.sql`: `lesson_report_events` immutable save/publish journal, `lesson_report_state` editable draft projection with CAS revision and a pointer to latest published version, and `lesson_report_publications` immutable snapshot history.
- A report can be authored only by an **active, qualified acting Sheikh** for a lesson that is `completed`, has `ended_at_ms` and an authoritative `lesson_lifecycle_events.end` row. A booking status alone never creates a report; no synthetic completion is emitted by the frontend.
- Historical primary teacher assignment at the lesson start OR an explicitly accepted, not-revoked substitute grant is required. Substitute may access **only that taught lesson's report** and has a bounded correction window of 24 hours after the **first publication**; first draft is additionally restricted to 24 hours after lesson end. No general roster/study-summary access is extended.
- SQL trigger enforces ownership of the learner/lesson, grade domain, revision, publication snapshot equality, acting-actor authorization and publication integrity. Only the Worker supplies the actor and clock from a signed Better Auth session.

## Endpoints (same-origin, no-store)

| Endpoint | Method | Response |
|---|---|---|
| `/v1/teacher/lessons/:lessonId/report` | GET | `{report:null}` or `{report:{lessonId,revision,status,publishedRevision,updatedAtMs,scope,strengths,corrections,nextPlan,memorization,recitation,tajweed}}` |
| `/v1/teacher/lessons/:lessonId/report-actions` | POST | `{kind:'save',operationId:UUIDv4,expectedRevision,scope,strengths,corrections,nextPlan,memorization,recitation,tajweed}` OR `{kind:'publish',operationId:UUIDv4,expectedRevision}` |
| `/v1/me/learners/:learnerId/reports` | GET | `{reports:[{lessonId,learnerId,revision,publishedAtMs,scope,strengths,corrections,nextPlan,memorization,recitation,tajweed}]}` |

`scope` is plain text for the **teacher-entered description** of taught ayat, not fabricated canonical Quran text. A future validated Quran anchor reference can be added in a separate migration. All text bounded. Grade fields are *independently nullable integers* `0..10`, never a combined score. No AI grading.

## State semantics

- First save with `expectedRevision:0` creates draft revision 1; subsequent saves increment revision with CAS. Save is private.
- Publishing accepts only the **current** saved draft with a nonblank scope. It atomically freezes an immutable snapshot and updates the latest published pointer; never overwrites an earlier snapshot.
- A subsequent save creates the next **private draft** while learner sees previous approved snapshot. Only explicit second publish updates the pointer.
- Duplicate operation UUID with identical input returns already-applied; conflicting UUID reuse or stale revision returns 409. Error/unknown network state must prompt re-read, not a blind new UUID retry.
- Student list is indexed and capped at 100 recent lessons, latest approved per lesson only; drafts/prior versions never returned. Absent end event returns 404 for teacher report actions, rather than manufacturing a completed report.

## Acceptance & gates

- Source tests: `workers/api/tests/test_lesson_reports.py` (SQLite immutable revision / actor / end-event / primary/substitute / timed scope); `workers/api/tests/lesson-reports.test.ts` (strict DTO/grades).
- **Now verified on isolated Dev:** migration 0013 and signed Better Auth synthetic report GET/POST. **Not verified:** browser screenshots/keyboard, multi-device UI, real Classroom, Cloudflare production. GitHub Verify is necessary but not sufficient.
- Isolated Dev E2E must create **synthetic** staff-owned scheduled lesson, qualified acting Sheikh, an explicit valid Start+End audit, save draft, prove owner sees empty, publish, owner sees version, save revision two, prove old version still visible, publish second, revoke access and test 404, other account 404, expired substitute 404. Cleanup synthetic records.
- Do not run generic Chrome on every commit. Use one targeted visual acceptance if requested (360/390/768/1280/1440).
- No Production changes, audio/AI, admin website, payment or WhatsApp. Booking is later Admin Dashboard work; classroom End event is a separate project. See ADR 0008.

**Rollback:** revert app/Worker and feature route changes; retain additive migration and immutable report events for future forward migration. Never drop the D1 tables/history in Production.
