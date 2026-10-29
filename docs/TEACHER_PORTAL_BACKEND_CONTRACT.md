## B2 backend implementation status (#138)

Staff-controlled `POST /v1/staff/teacher-actions` (provision dormant, qualify, activate, suspend, revoke qualification) uses verified Better Auth staff session and D1 `roles.manage`, append-only SQLite/D1 trigger-based audit, idempotent `operationId` and strict no-self-escalation checks. Phone-verified existing account required before provision/activate. **No self-service teacher or staff promotions, no real users or production migration.** No UI for management yet; admin portal can consume this private endpoint only after staging acceptance and staff bootstrap. `/teacher` default remains synthetic and authenticated read-only UI requires both build flags.

## B1 teacher read-only connection (#136, draft PR #137)

- `GET /v1/teacher/learners` uses D1-qualified Better Auth subject and time-bounded, primary-only assignment. The pre-existing `GET /v1/teacher/lessons` is also verified server-side.
- The **new separate browser read adapter** (`teacher-read-api.ts`) validates both response shapes, uses fixed same-origin GETs/HttpOnly-session credentials/no-cache, and fails closed on network/401/403/invalid response. It never returns mock fixtures for authenticated mode.
- Set BOTH `NEXT_PUBLIC_ACCOUNT_UI=true` and `NEXT_PUBLIC_TEACHER_READONLY_ENABLED=true` at **build time** to enable the protected read-only teacher portal. Default is off: the existing synthetic teacher demo remains completely unchanged. Only home/assigned-students/schedule are backed by real reads; other screens explicitly say their server integration is pending, with no fake grade/report/assignment save action.
- The live mode is **not** a teacher provisioning mechanism. Only previously provisioned, active, qualified D1 teacher subjects can read; no public role promotion, write API, real staff/child dataset or LiveKit. Remote staging with synthetic teacher identity and independent security verification remains a follow-up gate. Do not enable for general users without approved provisioning & validation.

# Sheikh Portal → Cloudflare Backend Contract (Teacher-first implementation #45)

**Status:** approved UI-driven API contract and implementation backlog, not a deployed API. Date: 2026-10-29.
**Ownership:** #45 (frontend), #46/#47/#48 (identity/booking/attendance), #49/#50 (classroom), #51 (reports), #52 (assignments), #54 (notification) and approved #11–#19, #120.

## 1. Current deliverable and truthful mode

The routes `/teacher`, `/teacher/schedule`, `/teacher/students`, `/teacher/preparation`, `/teacher/reports`, `/teacher/assignments`, `/teacher/notifications`, `/teacher/cases` are **React/Next.js frontend preview only**. Every visible example contains synthetic fixtures and a prominent banner. There are no requests that publish grades, send audio, charge lessons, send WhatsApp or create real assignments. Buttons requiring authenticated role/verified room membership are disabled until connected. The demo scenario picker deliberately tests absent teacher/student, late arrivals, dropouts, substitute, overdue room and empty teacher.

A teacher has no user role merely by loading the public preview. **Before enabling real user data**, server must authorize the Better Auth verified subject as active, qualified teacher, scope every lesson/learner and hide all teacher data from unauthorized accounts. Current read-only session-backed route `GET /v1/teacher/lessons` can be the first data adapter. Never mount teacher fixtures into authenticated real staff accounts as if they were live.

## 2. Real domain/state boundaries

- `teacher`: active, qualified, identity verified; teacher assignment with validity and revoked flag.
- `lesson`: original teacher-reserved **40-minute** interval and separate **30-minute instructional target**, actual teacher/learner joined intervals, teacher manual Start/End actor and times. No timer auto-end, ever.
- `student`: account+learner scoped identity; up to eight independent child profiles per household; no sibling cross-read; personal notes never teacher-accessible.
- `acting teacher`: may be primary or one-off substitute with positive guardian acceptance; substitute receives only that lesson's brief until its *manual end*, report correction for taught lesson until 24h after FIRST publication. No full history, unrelated students or persistent plan editing.
- `teacher_report`: `draft → published`; a published revision stays immutable and visible to learner until teacher approves new draft. Three independent nullable integer 0–10 scores, no automatic average. Draft can exist indefinitely after teacher End.
- `assignment`: teacher-authored Quran edition/surah/fromAyah/toAyah/type/due; each target learner has its own task/attempts and immutable submissions; teacher feedback and resubmissions linked to exact attempts.
- `incident`: provisional late/absence/disconnect report and separate authorized admin decision; no client-driven financial deduction or make-up grant.
- `notification`: application notices versus WhatsApp consent; T−24h and T−60m, one-hour WhatsApp only after verified channel opt-in/template.

## 3. Proposed authenticated endpoints (Worker actions, not implemented by teacher UI)

| UI action | Endpoint proposal | Server checks & response semantics |
|---|---|---|
| Home snapshot | `GET /v1/teacher/home` | verified teacher assignment; next authorized lesson, pending reports, audio reviews, notices; no fictional metrics |
| Roster | `GET /v1/teacher/learners` | only currently assigned primary learners, with separately scoped substitute lesson summary; stable cursor/search |
| Learner academic profile | `GET /v1/teacher/learners/:id` | primary access vs limited substitute `lesson_id`; never retrieve private annotations |
| Study plan read/edit | `GET /v1/teacher/learners/:id/plan`, `PATCH /.../plan` | primary teacher only; `If-Match` revision, immutable actor/before/after journal; not automatically a published assignment |
| Teacher calendar | already delivered `GET /v1/teacher/lessons`; future `GET /v1/teacher/calendar?from=&to=` | server-qualified teacher + lesson grant; D1 40m interval conflict/recurrence; chronological timezone-safe |
| Lesson preparation | `GET /v1/teacher/lessons/:id/brief` | current assigned acting teacher + only approved report and relevant tasks; substitute only accepted lesson scope, revoke immediately at End |
| Lobby/presence | `GET /v1/lessons/:id/lobby`, authenticated WS | verified acting teacher and correct learner; authoritative LessonDO member presence, device test local, no client-authoritative status |
| Teacher Start/End | `POST /v1/lessons/:id/start`, `POST /v1/lessons/:id/end` | teacher only; Start requires both joined and connected, idempotent event; End manual at ANY elapsed time, NEVER cron/timer |
| Media join | `POST /v1/lessons/:id/media-token` | short-lived LiveKit A/V token after verifying booking, actor, role and guardian substitute consent |
| Reports | `GET /v1/teacher/reports`; `GET/PUT /v1/teacher/reports/:id/draft`; `POST /v1/teacher/reports/:id/publish` | draft vs latest approved visibility; immutable published revisions, three nullable scores; substitute report permission for **taught** lesson only |
| Assignments | `GET/POST /v1/teacher/assignments` | verified primary teacher; validated Quran anchors, due date and all target learners; idempotent per-learner insert |
| Audio attempt | `GET /v1/teacher/assignments/:id/attempts/:attemptId/audio` | short-lived private R2 access, lesson/learner ownership checked at each request, no public raw URL |
| Teacher review/retry | `POST /v1/teacher/attempts/:id/review` | teacher-authoritative ayah-linked feedback and request retry; keep prior submission immutable |
| Notices | `GET /v1/teacher/notices`, `PATCH /v1/teacher/notices/:id/read` | only teacher's own notices; idempotent no-op if already read |
| Attendance/cases | `GET /v1/teacher/incidents`, `POST /v1/lessons/:id/no-show-report` | 15m from booked start plus verified presence; teacher may still start after late learner joins; no auto penalty |
| Delay / requests | staff Queue/Alarm and student help request endpoints | teacher-delay +5min admin alert, +10 urgent escalation; learner may exit and request make-up without being absent, admin verifies |
| Substitute | academy action + guardian accept/decline | no-consent = no access; scoped grant expires on teacher End, report correction 24h after first publication; audit |

The existing `/v1/teacher/lessons` route and learner owner calendar GET are *already merged backend reads*, but the teacher preview currently does not call them. Other rows are **proposals**, not shipped routes.

## 4. UI scenario-to-backend acceptance matrix

| Scenario in teacher preview | Required authoritative behavior |
|---|---|
| Brand-new teacher, no students | zero empty states for counts/list, not sample names or fake progress |
| Normal same-day next lesson | booked 40m; prep from latest **approved** report; safe student link |
| Sheikh arrives first | learner waiting badge, Start rejected until learner joins |
| Learner arrives first | teacher absent badge; learner cannot Start |
| Both joined | authenticated teacher Start only, verified room presence, prevent duplicate/forged requests |
| Student 18m late | optional teacher Start after arrival; existing provisional absence reconciled |
| Sheikh late 12m | admin +5/+10 escalations; student can leave and request review, never absent for protected departure |
| Disconnected during class | resumed same lesson and last acknowledged Quran page/ink/draft; no implicit End/penalty |
| Live beyond minute 40 | persistent warning and next appointment conflict; no forced room close; only sheikh End |
| Next student booked exactly +40m | no double booking, and **only one live class at a time**; next student cannot auto-start |
| Canceled/rescheduled lesson | no join, stale reminders invalidated, cancellation >=6h self-service rule, later admin |
| Accepted substitute | scoped prep and room; no overall student history or study-plan changes |
| Substitute before consent | no lesson access and no classroom token |
| Substitute after manual End | brief revoked immediately; taught lesson report correction window only |
| New teacher report | 3 independent 0–10/null assessments, draft initially invisible to learner |
| Published report edit | new draft, old approved revision shown to learner until new publish |
| Assignment to multiple children | separate learner tasks/attempts and access checks; no bulk cross-sibling leak |
| Private recitation attempt | explicit microphone opt-in, private R2, bounded teacher-scoped signed read and immutable prior attempts |
| Student retry requested | new attempt distinct, old original preserved |
| WhatsApp consent missing | no external send; in-app is independent channel |
| D1/DO/R2/provider unavailable | precise retryable error state, no forged saved/published success or phantom room |

## 5. API DTOs and client failure states

Recommended shared discriminated `Result`: `{ok:true,data,revision}` or `{ok:false,code,requestId,retryable}`. Codes:
`UNAUTHENTICATED`, `TEACHER_ACCESS_DENIED`, `LEARNER_NOT_ASSIGNED`, `SUBSTITUTE_CONSENT_REQUIRED`, `BRIEF_EXPIRED`, `LESSON_CANCELLED`, `WAITING_FOR_PARTICIPANTS`, `LESSON_NOT_STARTED`, `LESSON_ALREADY_ENDED`, `BOOKING_CONFLICT`, `CONCURRENT_LIVE_LESSON`, `REVISION_CONFLICT`, `AUDIO_NOT_READY`, `ARCHIVE_PENDING`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`.

Every page needs distinct loading, empty, offline, denied and retry states. A returned 403 must never silently show another learner or synthetic fixture. No optimistic published success before server ack. Retried writes carry `requestId` for idempotency; schema validates server fields and controlled client mutation fields separately. Paging and bounded strings for large classes.

## 6. Data isolation / privacy / security

1. Better Auth session cookie on same origin; teacher qualification/identity loaded server-side from D1; no `teacherId` or `role=teacher` from browser trusted.
2. Prejoin device previews local only; no live A/V recording, no automatic mic enable, no teacher remote unmute. Stream via LiveKit Cloud only; Workers/DO remain authoritative for learning state.
3. Teacher/student shared Quran annotations are layer-scoped with actor, seq, page/ayah anchor, revision, erase tombstone and audit. Student-private layer cannot be read/erased by teacher.
4. Classroom Start requires both verified members of the same exact lesson connected. Teacher End explicit and idempotent, never initiated by wall-clock, browser close or disconnected peer.
5. D1 schema and LessonDO write journal reconcile via durable outbox; do not claim cross-service atomic transactions.
6. Guardian consent to substitute explicit, checked at token issuance, WebSocket join, prep reads, report revisions; time-scoped permissions never retained accidentally.
7. Every action logs actor/resource/request and UTC time, not full child records, grades, Quran notes or phone.
8. Real releases must validate Cloudflare D1 migrations, role-bound HTTP, private R2 and two-device browser in staging with synthetic fixtures.

## 7. Engineering sequence from teacher UI to classroom

1. Merge teacher React preview after SSR, Vitest, desktop/mobile Chrome and architecture checks.
2. Implement teacher-only login provision / genuine `GET /v1/teacher/home`, list & profile APIs; read-only adapters replacing preview without fixture leaks.
3. Add protected plan, report, assignment and audio signed-data APIs with audit/versioning; allow mutation UI only after server paths pass tests.
4. Create dedicated LessonDO, authorized WebSocket presence, atomic teacher Start/End and reconnect, media token endpoint and LiveKit integration (secrets configured in Cloudflare).
5. Connect classroom toolbar to existing canonical Quran renderer and durable shared operation stream; archive report + approved teacher marks to Notebook and Training.
6. Implement admin incident, notifications and opt-in WhatsApp, backup/restore drills, cost and load tests, gradual rollout.

**Never close #45 as a production-integrated teacher portal merely because the preview is merged.**
