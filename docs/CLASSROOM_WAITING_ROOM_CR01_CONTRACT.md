# CR-01 — Signed Classroom waiting room on a per-lesson Durable Object (#196)

**Status:** source candidate only until exact-head Verify and isolated Cloudflare Dev two-account acceptance. This is NOT a live media room, formal attendance, a Classroom Start/End workflow or a real Quran-sync implementation. The final Admin Dashboard remains deferred.

## What already exists / source boundary

- The standalone public `/classroom` remains the explicitly labelled **demo**. The new `/classroom/live?role=teacher|learner&lessonId=…&learnerId=…` is a separate signed waiting-room frontend; query string selects which server endpoint to request, not which permissions the user possesses.
- Teacher `GET /v1/teacher/lessons/:lessonId/presence` and `POST .../presence-actions`, and learner `GET /v1/me/learners/:learnerId/lessons/:lessonId/presence` + `POST .../presence-actions`. POST JSON **exactly** `{action:'join'|'heartbeat'|'leave'}`; server does not accept actor/role fields from JSON, params cannot grant access.
- Every request rechecks signed Better Auth, active learner/owner, and exact completed? **No:** only **scheduled/live** lesson. Acting Sheikh checks current qualified/active status, primary assignment or accepted unrevoked substitute. Failed permissions 404, anonymous 401, wrong method 405, invalid body 400, missing/broken DO binding 503. No booking/teacher registration action here.
- Cloudflare Worker creates the DO stub with deterministic `idFromName(lessonId)`. DO keeps 25s role leases (two roles), rejects another principal occupying an active role, validates exact room identity, returns `teacherPresent`, `learnerPresent`, `bothPresent` and revision. Join is **explicit click**, heartbeat every ~8 seconds while client is visible; expiry on disconnection/restart means presence cannot be permanently fabricated from D1/calendar. Return `canStart:false` and `mediaReady:false` in every response. **Being in the waiting room does not verify physical attendance**.
- No timeout auto-start/end, no synthetic `lesson_lifecycle_events`, no media providers, no LiveKit token, no participant AV media, no ink writes, no teacher-approved Quran snapshots, no guardian voice recording. Main classroom audit constraints stay unchanged.
- `workers/api/wrangler.jsonc` registers `LESSON_ROOMS` SQL-backed class and migration for *LOCAL-only API worker*. The actual staging site Worker entry `workers/site/src/index.ts` also exports the class. Cloudflare Dev deployment binding/migration requires separately reviewed, Noor-only Santoreno staging config. Do not claim the DO exists remotely because the class builds locally.

## Upcoming release gates

1. Fast Node tests for two independently verified participant roles, wrong identity, lease expiry/rejoin, non-mutating snapshot, persistence across class reconstruction, invalid client actions and missing binding. TypeScript, build and optional native local DO smoke.
2. Isolated Dev DO provisioning and smoke with **two real synthetic Better Auth sessions**, distinct household and Sheikh, a pre-existing synthetic scheduled lesson and D1 assignments; both explicit join, one leave, idle lease expiry, revoke a teacher/learner, no accidental lifecycle Start/End. Test DO persistence after restart/reconnect where possible; confirm mobile UX only after backend checks.
3. Follow-up **CR-02**: LiveKit Cloud audio/video using short-lived tokens minted *only after fresh D1 role validation*, audio/video permissions and two-device test; no auto media until user allows it.
4. **CR-03/CR-04**: trusted Live Quran page/ink sync in DO, teacher Start/End with authenticated DO presence, D1 immutable audit and outbox → Phase 08B2 archive (#194). Each stage has its own PR/Dev proof.

**Rollback:** disable waiting-room route and DO binding while keeping independent D1 lesson and report history. Never turn off guardian privacy checks or deploy to Production just to pass test fixtures.
