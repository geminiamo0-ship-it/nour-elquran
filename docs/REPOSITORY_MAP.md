## 2026-11-01 Admin operational package #309
- apps/web/src/features/admin/{AdminOperations.tsx,AdminOperations.module.css,admin-operations-client.ts,admin-operations.test.tsx} — signed, confirmed and audit-aware operations UI/client for existing teacher, schedule and attendance pages; deliberately no paid booking.
- workers/api/src/staff-teacher-transition.ts — server-only teacher roster ID -> private auth subject resolution and role-action reuse; registered in workers/api/src/auth/routes.ts via POST /v1/staff/teachers/transition.
- workers/api/migrations/0027_teacher_active_lesson_guard.sql — transaction-safe no-orphan active lessons when Sheikh status changes; workers/api/tests/{staff-teacher-transition.test.ts,test_teacher_role_active_lesson_guard.py} verify contracts.
- docs/ADMIN_OPERATIONS_PACKAGE_20261101.md — current scope, remaining Admin blockers, permission and Dev acceptance matrix.

## #307 consolidated staff collections

- `workers/api/src/staff-collections.ts`: four fixed SQL queries and exact field validators: student profiles, -7/+30-day lesson calendar, monthly subscription cycle lesson units and attendance appeal statuses. Every request checks current verified active D1 `roles.manage` grant before reading. Maximum 50 rows + honest `truncated`, no phone, guardian identity, incident reasons, finance or dynamic query values.
- `workers/api/src/auth/routes.ts`: staff-only `GET /v1/staff/collections?view=...` with strict allowlist/one query parameter; method 405, disabled Worker 404, invalid view 400, signed staff 200, denial 401/403 and D1 failure 503. Static source uses existing default-off Dev Admin opt-in only.
- `apps/web/src/features/admin/admin-collections-client.ts`: schema-checked same-origin no-store GET for four exact row shapes and signed error codes.
- `apps/web/src/features/admin/AdminCollectionPanel.tsx`: one responsive RTL reusable read-only list with honest local-only search, no mutation, error/empty/loading/denied states and session-keyed abort.
- `apps/web/src/features/admin/{AdminShell.tsx,admin-navigation.ts,AdminSections.tsx,AdminPortal.module.css}`: four real connected views alongside overview/Sheikh, links and responsive card layouts. Settings remains disabled.
- `workers/api/tests/staff-collections.test.ts`, `apps/web/src/features/admin/{admin-collections-client.test.ts,AdminCollectionPanel.test.tsx}`, `scripts/cloudflare-auth-smoke.mjs`: fixed-allowlist, typed, signed native D1 tests. No new migrations, audio, WhatsApp or cash payments.

## #305 Admin teacher directory (source candidate)
- `workers/api/src/staff-teacher-directory.ts`: bounded 50-row staff-only verified D1 query; deterministic order, counts, no contacts/learner identities, fail-closed on malformed results. `workers/api/src/auth/routes.ts` adds signed default-OFF `GET /v1/staff/teachers` beside overview.
- `apps/web/src/features/admin/admin-teachers-client.ts`: strict response parser, signed same-origin no-store GET; `AdminTeacherDirectory.tsx`: mobile RTL read-only cards, real empty/error/denied/loading and 50-row warning; `AdminShell.tsx` mounts only after signed overview authorization.
- `apps/web/src/features/admin/{AdminSections.tsx,admin-navigation.ts,AdminPortal.module.css}`: connects teachers only, keeps other sections honest and non-actionable.
- `workers/api/tests/staff-teacher-directory.test.ts`, `apps/web/src/features/admin/admin-teachers-client.test.tsx`, `scripts/cloudflare-auth-smoke.mjs`: backend/parser/signed native D1 regression. No invite/activation/assignment/finance writes. Dev/viewport/reviewer acceptance pending.

## #302 initial staff-only Admin interface (source candidate)
- `apps/web/src/app/admin/{page.tsx,layout.tsx,students,teachers,schedule,subscriptions,attendance,settings}`: thin static export entrypoints; signed AdminShell owns all data and section gates.
- `apps/web/src/features/admin/AdminShell.tsx`: build-time dual opt-in, account/session recheck, source-ID-bound state and AbortController, no staff navigation or aggregate data until signed remote check. Mobile RTL role-verified navigation.
- `apps/web/src/features/admin/AdminSections.tsx`, `admin-navigation.ts`, `AdminPortal.module.css`: accessible summary of four real counts and honest inactive section explanations. No fake actions.
- `apps/web/src/features/admin/admin-overview-client.ts`: strict non-bookable/no-PII four-field aggregate response parser, same-origin credentials/no-store GET.
- `workers/api/src/staff-overview.ts`: verifies current D1 staff roles.manage grant, reads only four safe COUNT totals (active learners, qualified teachers, future scheduled lessons, completed lessons); no names, phone or financial amounts.
- `workers/api/src/auth/routes.ts`: signed `GET /v1/staff/overview` behind Worker `NOOR_ADMIN_PORTAL_ENABLED=true` opt-in; client build separately requires `NEXT_PUBLIC_ADMIN_PORTAL_ENABLED=true` and account UI. All OFF by default; no Production.
- `workers/api/tests/staff-overview.test.ts`, `apps/web/src/features/admin/*test*`: staff denial/query scope, malformed response, default-off UI/route honesty tests.
- **Not delivered:** staff management CRUD, any unauthorized finance record, attendance decisions, invitations, external integrations or signed Dev UI acceptance.

## #244 connected academic ledger UI (candidate)
- apps/web/src/features/shared/subscription-ledger-client.ts: signed owner GET, strict non-bookable contract and invalid-response denial; adjacent parser tests.
- apps/web/src/features/student/components/ConnectedSubscriptionLedger.tsx: read-only student D1 ledger view, loading/error/retry and no payment claims; adjacent initial-state test. SubscriptionWorkspace keeps payment UI disabled.
- No credit writer, paid booking or Production. Exact-head CI and Dev E2E pending.

## #244 native D1 0023→0024 booked trial guard (PR #280 candidate)
- `scripts/fixtures/trial-slot-native-pre0024.sql`: disposable verified-staff and owner booking fixture, real synthetic 40-minute scheduled lesson seeded after native 0023 and before 0024. No personal data.
- `scripts/cloudflare-local-smoke.sh`: correctly stages historical 0022 then 0023 then 0024, rejects booked withdrawal atomically, permits closure only after owner cancellation, verifies replay and FK integrity. Existing Sheikh pen/highlight and sibling regression preserved.
- This is **native local D1 CI only**, not signed Cloudflare Dev acceptance. #244/#286 remain OPEN; 0024 is not approved for remote deployment until review and #286 Dev gate.

## #244 / 0024 booked trial closure guard after merged 0023 (candidate)
- `workers/api/migrations/0024_trial_slot_close_booking_guard.sql` replaces only the trial-slot closure trigger, denying booked slots without altering lessons. `workers/api/tests/test_free_trial_booking.py` checks full 0023→0024 migration metadata, trigger presence, booking denial and post-cancel closure. Remote Dev acceptance is pending.

## Final Classroom runtime evidence — #240
Classroom Dev accepted in the single synthetic run: https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41140055151
App commit: 57c59518a544672fa4c213d81b0e49208f5b2b70; test harness: 5875cc18344cc8871102499945ad8dd2cc3fc0f5.
Verified real signed dual-browser synthetic LiveKit, teacher mic mute/release and learner opt-in, Quran page+ayah sync, ink/eraser and reconnect, mobile screenshots, signed Start/End D1 audit, private correction to report draft, explicit publish and the same approved report after teacher revocation.
6236 pinned Hafs anchors verified. Automated isolated Dev PASS, not human visual acceptance or Production certification; no production data/media was modified.
Tracked feature Issues #231 #232 #235 #236 remain open until owner personal visual QA. Browser screenshots are in noor-profile-remote-browser artifact of the final staging run.
Earlier blockers were fixed by Noor PR #239 (canonical D1 lookup instead of HTTP 503) and Santoreno PR #296 (report revision 2->3: compare exact approved snapshot).
Relevant source: workers/api/src/classroom/quran-sync.ts, lesson-room.ts, lesson-lifecycle-write.ts, live-corrections.ts; apps/web/src/features/classroom/ConnectedWaitingRoom.tsx, LiveLessonLifecycle.tsx, LiveLessonMedia.tsx, QuranVersePicker.tsx, ConnectedClassroomNotes.tsx. QA harness in geminiamo0-ship-it/santoreno scripts/noor_private_staging.py, noor_classroom_staging.py and noor_staging_livekit_browser.mjs.

## Dev Quran shared verse 503 remediation — #238 (2026-10-31)
- Single combined staging run [Santoreno #41137769340](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41137769340) successfully deployed Noor main and passed real two-browser LiveKit synthetic A/V, Sheikh mute/release+student opt-in, shared Quran pagination/ink/eraser, phone viewports and reconnect. Failed *after* those at first signed POST Quran selected Ayah (HTTP 503). Do NOT claim completed lifecycle/report yet.
- Fix candidate #238 changes server-side verse-to-page proof from cross-Worker HTTP fetch to the already audited D1 `quran_ayah_anchors` exact `(edition,surah,ayah,page)` row. Edition `hafs-kfqc:v1.1.1`, manifest pinned `864c5474872876b3db8a328d8c74781be83c004a7cdb168ffb4b7eb57477edd2` and 6236 anchors independently reconciled by staging. Wrong page/edition/missing D1 fail closed. No new Quran data or external media and no changes to browser rendering.
- Retest integrated source Verify and then repeat same Dev synthetic complete classroom Start→Ayah→correction→End→report QA; Production remains untouched.

## #235/#236 Classroom signed real lifecycle and private corrections (candidate)
- `workers/api/src/classroom/lesson-lifecycle-write.ts`: actor-scoped GET for teacher and owning student, explicit signed teacher Start/End with D1 transactional batch, immutable lifecycle event, duplicate race response; after END triggers existing media-enforcement DO/outbox wake and auto-seeds private report draft via `lesson-reports.ts` if notes exist. `workers/api/src/bindings.ts`: optional real D1 `batch` API typed (missing binding fails closed). `workers/api/src/auth/routes.ts`: exact signed GET/POST routes, no client roles.
- `workers/api/src/classroom/live-corrections.ts` and `lesson-room.ts`: validated, private acting-Sheikh-only typed correction log; current DO page+verse authoritative selection required, append/idempotency and 120-entry cap, server-only seed after end. `workers/api/tests/lesson-lifecycle-write.test.ts` and `live-corrections.test.ts`: targeted mocks/state/restart and authenticated authorization edge cases.
- `apps/web/src/features/classroom/LiveLessonLifecycle.tsx`: small verified Start/End header panel with explicit end confirmation and report link; `ConnectedWaitingRoom.tsx` phase status and media stop on completed; `ConnectedClassroomNotes.tsx` real teacher-only correction/notes editor; CSS kept compact for phone. `apps/web/src/features/teacher/TeacherConnectedReports.tsx`: exact lesson selected from handoff query.
- Release and actual two-account browser verification not yet done. Do not confuse source CI success with runtime proof.

## #231 / #232 classroom owner QA source integration
- apps/web/src/features/classroom/QuranVersePicker.tsx, quran-verse-navigation.ts and quran-verse-selection.ts: canonical Surah/Ayah picker and strict verified page search. ConnectedWaitingRoom.tsx and ConnectedClassroom.module.css integrate compact no-scroll floating rail and teacher-selected highlighted verse. apps/web/src/features/student/index.ts exports canonical Quran index adapter.
- workers/api/src/classroom/quran-page.ts, quran-sync.ts: optional versioned verse selection, idempotent receipts and verified publisher page metadata; existing LessonDO room transactions persist selection. Tests: workers/api/tests/classroom-quran-sync.test.ts and apps/web/src/features/classroom/quran-verse-navigation.test.ts.
- PR #233 predecessor: workers/api/src/classroom/mic-policy.ts, lesson-room.ts, livekit-mute.ts, auth/routes.ts, apps/web/src/features/classroom/LiveLessonMedia.tsx and LiveClassroom.module.css provide Sheikh mute/release with voluntary learner re-enable. Source only, not real 2-device provider acceptance.

## CR-02B2 write-time wake and mute real Dev evidence
- `docs/CLASSROOM_CR02B2_WRITE_MUTE_DEV_ACCEPTANCE.md` anchors Noor main Verify #41002079116, Santoreno Cloudflare no-secret Dev #41002323938. Mute track selection is server-only; actual LiveKit Cloud provider unconfigured/untested, #206 stays open.

## CR-02B2 #206 staff write-time media + mute source
- `workers/api/src/classroom/media-enforcement.ts`: after signed D1 staff changes, wake exact lesson DO and affected active teacher sessions. `workers/api/src/classroom/lesson-room.ts`: private server binding `/internal/reconcile-media` endpoint runs D1-authorized alarm. `workers/api/src/classroom/livekit-mute.ts`: exact learner, microphone-only LiveKit ListParticipants/MutePublishedTrack, server-minted admin token. `workers/api/src/auth/routes.ts`: signed teacher mute POST and staff post-commit wake. `apps/web/src/features/classroom/LiveLessonMedia.tsx`: teacher-only opt-in mute button. `workers/api/tests/{livekit-mute,classroom-write-enforcement}.test.ts`. Contract `docs/CLASSROOM_CR02B2_WRITE_MUTE_CONTRACT.md`. No production/provider tests yet.

## CR-02B2 source merge and evidence
- `docs/CLASSROOM_CR02B2_SOURCE_ACCEPTANCE.md` records Noor #207 merged, main Verify #40999944470 and the limits of simulated RoomService/DO tests. No provider-enabled connected eviction accepted; do not conflate source CI and live media.

## CR-02B2 #206 provider-side eviction source
- `workers/api/src/classroom/livekit-admin.ts`: signed room-scoped LiveKit RoomService RemoveParticipant transport, 60s admin JWT and token cutoff. `livekit-token.ts`: shared opaque names and durable media-intent pre-join. `lesson-room.ts`: bounded durable pending ejections, 10s D1 reconciliation/lease expiry alarms, provider retries with rejoin fence; `presence.ts`: fail-closed 409 pending code. `workers/api/tests/livekit-admin.test.ts`, `classroom-eviction.test.ts` validate signed transport and DO retry/reconstruction/expiry. `docs/CLASSROOM_CR02B2_PROVIDER_EVICTION_CONTRACT.md` separates source from real provider acceptance.

## CR-02B1 #204 LiveKit browser SDK client (source only)
- `apps/web/package.json`, `pnpm-lock.yaml`: pinned `livekit-client` 2.23.0 (lockfile from temporary branch-only GitHub Action, action removed before PR). `apps/web/src/features/classroom/media-credentials.ts`: strict signed POST `{}` token client; `media-credentials.test.ts` validates payload and denial. `LiveLessonMedia.tsx`: client lazy SDK opt-in mic/camera remote tracks and reconnect cleanup. `ConnectedWaitingRoom.tsx` mounts it only after successful explicit signed room join. `docs/CLASSROOM_CR02B1_MEDIA_CLIENT_CONTRACT.md` lists release blockers, no connected-user eviction yet.

## CR-02A exact Dev acceptance evidence
- `docs/CLASSROOM_LIVEKIT_CR02A_DEV_ACCEPTANCE.md` anchors Noor main Verify #40996405754 and Santoreno isolated real Dev #40996681563. The Dev service deliberately has no LiveKit secrets: valid signed issuer endpoint returns 503 with no token. A/V actual provider integration and already-connected participant eviction remain CR-02B.

## Classroom CR-02A LiveKit token candidate #200
- `workers/api/src/classroom/livekit-token.ts`: server-only LiveKit URL/secrets validation, 120s HMAC SHA256 scoped JWT mint, strict no-admin/no-record/no-data grant, D1 lesson schedule and actor-specific DO lease checks. `workers/api/src/auth/routes.ts` adds two signed POST media-token endpoints, `workers/api/src/bindings.ts` adds optional server secrets. `workers/api/tests/livekit-token.test.ts` signs/validates synthetic JWT and rejects forgery/off-room/expired/unconfigured requests. `docs/CLASSROOM_LIVEKIT_CR02A_TOKEN_CONTRACT.md` distinguishes backend scaffold from actual media and revocation.

## CR-01 isolated Dev acceptance reference
- `docs/CLASSROOM_CR01_DEV_ACCEPTANCE.md` records Noor main Verify #40993668189 and Santoreno real DO #40994099005; only signed waiting-room connectivity is accepted, not media or attendance. Site DO class in `workers/site/src/index.ts`, local Wrangler binding only; production root config remains unchanged. UI StrictMode follow-up #199, classroom #196 remains open.

## CR-01 signed waiting room files (#196; source-only)
- `workers/api/src/classroom/lesson-room.ts`: SQLite-backed Durable Object lease reducer and fetch handler; `presence.ts`: strict signed session transport. `workers/api/src/auth/routes.ts`: server verified owner/acting Sheikh room endpoints. `workers/api/src/bindings.ts`, `workers/api/src/index.ts`, `workers/site/src/index.ts`, `workers/api/wrangler.jsonc`: DO exposure and local-only binding/migration.
- `workers/api/tests/classroom-presence.test.ts`: TTL/role/restart/authorization-negatives. `apps/web/src/features/classroom/ConnectedWaitingRoom.tsx`, `apps/web/src/app/classroom/live/page.tsx`, authenticated student LessonHub and Sheikh schedule: no media, no fake presence. Contract `docs/CLASSROOM_WAITING_ROOM_CR01_CONTRACT.md`.

## Phase 08B1 archive source (#192)
- D1 `workers/api/migrations/0015_lesson_quran_archive.sql`: append-only, sealed, canonical-page and bounded teacher mark archive tied to published report revision/END event.
- Worker `workers/api/src/lesson-quran-archive.ts` and `auth/routes.ts`: only signed household GET; no archive writing endpoint.
- UI `apps/web/src/features/shared/lesson-archive-client.ts`, `student/components/PublishedLessonArchive.tsx`, `ConnectedNotebookWorkspace.tsx`: strict DTO and read-only existing Quran renderer.
- Tests: `workers/api/tests/test_lesson_quran_archive.py`, `apps/web/src/features/shared/lesson-archive-client.test.ts`. Docs `LESSON_QURAN_ARCHIVE_08B1_CONTRACT.md`. No Dev/Production/source producer evidenced yet.

## Phase 08A #190 notebook source files
- `workers/api/migrations/0014_notebook_private_notes.sql` private notes projection and immutable operation journal with completed-lesson authorization guard; not Quran annotations.
- `workers/api/src/notebook-notes.ts` and `auth/routes.ts` signed owner operations; backend tests `notebook-notes.test.ts`, `test_notebook_notes.py`.
- `apps/web/src/features/shared/notebook-client.ts`/tests and public `shared/index.ts`: strict same-origin requests; `student/components/ConnectedNotebookWorkspace.tsx` with `NotebookWorkspace.tsx` connected-mode switch.
- `docs/NOTEBOOK_PHASE_08A_CONTRACT.md` release gates. Source only; no remote D1 or browser accepted before evidence.

## Phase 07A source→Dev verification evidence (2026-10-30)
- Noor [PR #187](https://github.com/geminiamo0-ship-it/nour-elquran/pull/187) merged; [main Verify #40986308630](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40986308630) PASS. Santoreno [PR #257](https://github.com/geminiamo0-ship-it/santoreno/pull/257) deployed existing Dev with migration 0013 and signed HTTP [#40986426733](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40986426733) PASS. Report UI files exist but one owner visual QA remains open. Classroom End generator and R2/PDF archive absent. See report contract for exact scope.

## Phase 07A report files (#186; source-only until verified)
- `workers/api/migrations/0013_lesson_reports.sql`: immutable report events, draft projection, published snapshot/last approved pointer and completed lesson/actor/substitute authorization triggers.
- `workers/api/src/lesson-reports.ts`, `workers/api/src/auth/routes.ts`: validated commands and Better Auth teacher/owner report endpoints.
- `workers/api/tests/lesson-reports.test.ts`, `workers/api/tests/test_lesson_reports.py`: DTO and SQL role/CAS/version/END/substitute tests.
- `apps/web/src/features/shared/lesson-report-client.ts`, `teacher/TeacherConnectedReports.tsx`, `teacher/TeacherReadOnlyView.tsx`, `student/components/ConnectedProgressReports.tsx`, `student/components/ProgressWorkspace.tsx`: connected UI; public demo remains separate.
- `docs/LESSON_REPORTS_PHASE_07A_CONTRACT.md`: route contract and acceptance gate. `docs/adr/0008-admin-last-teacher-onboarding.md`: final Admin ownership and invitation-only Sheikh lifecycle.

## Phase 06A1 verified Dev safety boundary (2026-10-30)
- [Santoreno PR #255](https://github.com/geminiamo0-ship-it/santoreno/pull/255) adds `scripts/noor_private_staging.py::verify_disabled_recitation_audio` and Python mocked regressions: existing dedicated `noor-core-staging` D1 0012 and both lock triggers, no asset metadata, per-owner sibling disabled GET, foreign 404, anonymous 401, grant POST 405. Actual [Dev remote #40979386785](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40979386785) SUCCESS. These are policy-denial tests, **not** private media upload/playback tests or child privacy approval.
- Noor server paths and SQL under #182/#184 are now merged and staged only for disabled read; parent #180 remains blocked on guardian identity, policy, private R2 provisioning, retention/delete/export and full media ACL tests.

## #182 Phase 06A1 locked audio backend groundwork (source only)
- `workers/api/migrations/0012_recitation_audio_privacy.sql`: immutable consent and asset metadata, current owner/same-submission scope triggers, explicit grant/upload blocker triggers, no real recordings.
- `workers/api/src/private-recitation-audio.ts`: strict media envelope and opaque private R2 keys, non-cacheable headers, hard-disabled flag. No actual bucket binding or media API.
- `workers/api/src/auth/routes.ts`: authenticated owner-only disabled `/v1/me/learners/:learnerId/recitation-audio-policy` GET; no public grant/upload/playback.
- `workers/api/tests/private-recitation-audio.test.ts`, `test_recitation_audio_privacy.py`: synthetic parser, SQL deny and immutability tests. [Full privacy contract](PRIVATE_RECITATION_AUDIO_CONTRACT.md). Parent #180 remains blocked on guardian verification, retention/delete/export, bucket provisioning and Dev tests. User owns #173/#178 visual review.

## 05A/05B real Dev D1 routes — postmerge verification (2026-10-30)
- 05A `workers/api/migrations/0010_published_assignments.sql`, `workers/api/src/published-assignments.ts`: verified publisher; [Dev remote #40971275548](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40971275548) passed.
- 05B `workers/api/migrations/0011_assignment_submissions.sql`, `workers/api/src/assignment-submissions.ts`: owner-scoped `GET/POST /v1/me/learners/:learner/assignments/:task/submissions` and active qualified primary teacher `GET/POST /v1/teacher/learners/:learner/assignments/:task/reviews`. Append-only retry/accept history max 5. `StudentAssignmentSubmission.tsx` and `TeacherAssignmentReview.tsx` use `assignment-attempt-client.ts`; [Dev remote #40975149637](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40975149637) passed API security/owner/teacher/replay.
- UI visual acceptance in #173/#178 not yet done. R2 voice #180 remains separate/off until private bucket, guardian consent and retention policy. Below source-only sections are earlier history.

## Phase 05B #178 (source-only; pending verification)
- `workers/api/migrations/0011_assignment_submissions.sql`: immutable submissions/reviews, current owner/current primary teacher, max five retry attempts, one immutable teacher decision per attempt. Independent of published-task 0010 projection; no editing the published Quran target.
- `workers/api/src/assignment-submissions.ts`, `auth/routes.ts`: signed-session backed GET/POST student submissions and teacher reviews, operation UUID replays and 409 CAS.
- `apps/web/src/features/shared/assignment-attempt-client.ts`, `student/components/StudentAssignmentSubmission.tsx`, `teacher/TeacherAssignmentReview.tsx`: strict DTO, explicit submit, lazy teacher review with consent-neutral text only, no voice upload.
- Native Cloudflare local test `scripts/cloudflare-auth-smoke.mjs`; SQLite `workers/api/tests/test_assignment_submissions.py`; TS parser tests.
- **Not deployed.** Parent #173 D1 publish API did pass Santoreno Dev #40971275548 but still needs targeted UI visual acceptance; audio/R2 postponed.

## Connected account learner lifecycle — #157 (Dev verified)
- `workers/api/migrations/0008_learner_profiles.sql`: additive profile revision and immutable D1 event + before/after audit; rejects archival with scheduled/live lessons.
- `workers/api/src/learner-profile-actions.ts`, `auth/routes.ts`, `owner-learners.ts`: verified Better Auth owner-only rename/archive command with operation UUID/CAS, active-only learner reads; no destructive delete.
- `apps/web/src/features/account/{api.ts,AccountProvider.tsx,AccountProfiles.tsx}`: runtime-checked revision DTO and connected ACK-only edit/archive actions; the normal student shell retains private selected learner. `scripts/cloudflare-auth-browser.mjs` and `scripts/cloudflare-auth-smoke.mjs` verify native account/sibling flow.
- [Noor main Verify 40958071853](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40958071853) and [Santoreno remote Dev 40958341460](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40958341460) PASS; five real remote Chrome viewport screenshots in artifact ID 12934533154.
- Scope is staging/synthetic accounts only. Guardian OTP/consent, password recovery, and teacher portal remain pending. Visual follow-up #160, connected teacher #159.

## #149 private Quran connected-page readiness

- `apps/web/src/features/student/private-mushaf-readiness.ts`: pure, fail-closed selected learner + active page hydration guard for connected writes; `private-mushaf-readiness.test.ts` covers page/learner/failure/demo cases.
- `usePrivateMushafSave.ts`: tracks the learner identity of the hydrated index and exact page identity; refuses stale-page mutations and post-failure edits. `components/MadinahReader.tsx`: only current hydrated leaf can draw; empty note state distinguishes account from local demo.
- This is source-only until exact-head CI and isolated QA Worker/D1/browser evidence; no change to live classroom, D1 schema or production.

## Private learner Quran persistence #144

- `workers/api/migrations/0007_private_mushaf.sql`: immutable, owner-verified D1 per-learner operation journal and current item projections.
- `workers/api/src/private-mushaf.ts` + `auth/routes.ts`: strict input + canonical Quran metadata and owner-only page/index read, version-guarded writes.
- `apps/web/src/features/student/private-mushaf-client.ts`, `usePrivateMushafSave.ts`, `components/MadinahReader.tsx`: real opt-in reader hydration + serialized server ACK/pending/retry; demo unchanged.
- `workers/api/tests/test_private_mushaf.py`, `private-mushaf.test.ts`, `scripts/cloudflare-auth-smoke.mjs`: migration and synthetic D1 owner scope/erase/restore tests.
- `docs/PRIVATE_QURAN_PERSISTENCE_CONTRACT.md`: scope, flags, staging canonical edition prerequisites, offline failure limitations.

## Master durable-data map — #142

- `docs/PERSISTENCE_AND_LESSON_RECOVERY_MASTER_PLAN.md`: comprehensive D1 / LessonDO / private R2 persistence and recovery map across learner reader pen/marker/notes/bookmarks, live shared stroke protocol, reports/publication, diary, homework audio, academic plans, attendance, financial ledgers, notifications, privacy, offline, operations and restore. **Planning only**; no code/migrations deployed.
- [Issue #142](https://github.com/geminiamo0-ship-it/nour-elquran/issues/142): master implementation backlog and acceptance, referencing existing specialty issues #87/#102/#120/#51/#52. Reuse existing canonical Quran renderer and permission constraints.
- Next backend slice after B1–B3 synthetic staging: first real authenticated personal Quran `annotations/ops` and reading position, then synced LessonDO classroom and published immutable archive/reports; test actual server ACK and reload (not mere React-state success).

## Staff schedule B3 #140

- `workers/api/migrations/0006_staff_schedule.sql`: atomic immutable D1 staff event ledger for primary teacher assignment, revocation and scheduled 40m class create/cancel; existing 0001/0003 triggers remain authoritative.
- `workers/api/src/staff-scheduling.ts`: strict action DTO, safe server-now window, verified staff gate and idempotent event execution. No editable academic plans/media.
- `workers/api/src/auth/routes.ts`: `POST /v1/staff/schedule-actions` under Better Auth/origin and D1 roles.manage.
- `workers/api/tests/test_staff_schedule.py`, `staff-scheduling.test.ts`: full SQL lineage and D1/TS validation/authorization/replay tests.
- `scripts/cloudflare-auth-smoke.mjs`: same-origin local Better Auth/D1 B3 two accounts, one teacher, real assignment and booking reading back from teacher/learner APIs, 40m/conflict/cancel/revoke.

## Teacher Backend B2 #138

- `workers/api/migrations/0005_teacher_roles.sql`: append-only role audit + atomic staff-authorized D1 teacher role transitions; no public self-service grants.
- `workers/api/src/staff-teachers.ts`: strict staff action parsing, D1 grant checks, idempotency and fail-closed orchestration.
- `workers/api/src/auth/routes.ts`: POST `/v1/staff/teacher-actions` after verified Better Auth session / origin checks.
- `workers/api/tests/test_teacher_roles.py` and `staff-teachers.test.ts`: real migration constraint and TS permission/validation unit tests.
- `scripts/cloudflare-auth-smoke.mjs`: native local synthetic staff/teacher session, provision/activate/revoke tests, no real accounts.
- No remote databases, no teacher UI flag change.

## Teacher Backend B1 #136 (Draft PR #137)
- `workers/api/src/teacher-roster.ts`: bounded active-primary D1 roster scoped to D1-qualified Better Auth subject. No substitute grant broadens roster.
- `workers/api/src/auth/routes.ts`: `GET /v1/teacher/learners` authenticated read-only.
- `workers/api/tests/test_teacher_roster.py` + `teacher-roster.test.ts`: production SQL and qualified-subject gates.
- `apps/web/src/features/teacher/teacher-read-api.ts`: same-origin typed read adapters and strict DTO validation.
- `TeacherReadOnlyView.tsx` + `TeacherReadOnly.module.css`: opt-in locked-down teacher home/roster/schedule; no demo fixture fallback, no writing.
- `TeacherShell.tsx`: mode switch guarded by account UI + teacher readonly build flags. Normal teacher preview untouched.
- `teacher-readonly.test.ts`: client parsing/denial/network checks. No real student data or production deployment.

## Classroom #120 — draft booking/lifecycle integrity
- `workers/api/migrations/0003_teacher_schedule.sql`: additive D1 40-minute booking/eligibility/conflict guards, single-live and terminal-state invariants, and pre-start lifecycle shortcut rejection. No HTTP Start/End authorization or verified presence.
- `workers/api/tests/test_teacher_calendar.py`: synthetic SQLite migrations and atomic booking/lifecycle regressions. Native local Wrangler and full Chrome/build checks are separate CI gates.

## CLASSROOM #120 / PR #121 — draft concurrent-live guard
- `workers/api/migrations/0003_teacher_schedule.sql`: 40-minute booking, teacher/learner eligibility and conflicts; added INSERT/UPDATE SQLite/D1 guards for at most one live room per teacher and learner, independent of adjacent reserved slots. This does not implement authorized Start/End or presence.
- `workers/api/tests/test_teacher_calendar.py`: synthetic SQLite regression coverage for live-room overrun, independent concurrent rooms and direct-live-insert bypass. Draft PR only; no remote migration.

# Repository map and file ownership

## STAGING #114
- `workers/site/src/staging-access.ts`: staging-only Basic access gate; refuses missing secret, protects all Worker-routed requests; production unaffected.
- `workers/site/src/index.ts`: stage gate precedes static asset/API dispatch; **deployment must set `assets.run_worker_first=true`** to intercept static resources too.
- `tests/staging-access.test.mjs`: deny missing/invalid credentials and unconfigured stage; preserve production behavior.
- `docs/NOOR_STAGING_RUNBOOK.md`: isolated Cloudflare staging D1/Worker resource contract, deployment gates, smoke, limits, rollback.


## AUTH-02 #112
- `apps/web/src/features/account/`: same-origin validated API DTO/client, safe public error mapping, lease-guarded session context, signup/login/partial-onboarding recovery, profiles and logout. Public index is the only cross-feature import surface. CSS uses existing ivory/green/gold palette.
- Root layout hosts the account provider. Landing swaps demo enrollment for opt-in account UI; StudentShell gates connected pages and mounts account-keyed StudentProvider with real profile IDs and empty learning snapshots. Existing demo behavior remains when UI flag is off; no authenticated names/contacts/credentials enter demo session storage.
- `workers/site/src/index.ts`, `workers/site/tsconfig.json`, root wrangler: compose API + static assets under one origin; unknown pages retain ASSETS 404. Root config contains no remote D1 or auth secret. NEXT_PUBLIC_ACCOUNT_UI enables UI at build; AUTH_ENABLED enables server independently.
- `scripts/chrome-local.mjs`, `cloudflare-auth-browser.{sh,mjs}`: isolated synthetic browser journey with response-loss fault injection and mobile/desktop screenshots, run in fourth Verify job after opt-in build. No dependency or lock graph changes.

## AUTH-01 #110
- `docs/adr/0005-d1-phone-password-auth.md`: maintained-library choice, phone/password integration default, verification/recovery rollout prerequisites and safe rollback.
- `workers/api/src/auth/{settings,config,schema}.ts`: explicit opt-in configuration, pinned Better Auth + first-party Drizzle D1 adapter and matching SQLite models. No home-grown password hashing or session signing.
- `workers/api/src/auth/{routes,input,accounts}.ts`: bounded/whitelisted public credentials and learner routes; normalize phone, enforce origin, map verified session subject to active core account, query ownership in SQL. `responses.ts` centralizes non-cacheable safe responses.
- `workers/api/migrations/0002_auth.sql`: additive auth users/sessions/credentials/verifications/rate-limit tables and database-enforced eight-active-learner insertion cap. 0001 is unchanged.
- `scripts/cloudflare-auth-smoke.{sh,mjs}`: disposable native local registration/session/ownership/revocation/expiry gate, included in the fourth Verify job. Root manifest/lock pin Better Auth 1.7.14 and Drizzle 0.45.2; Wrangler enables nodejs_compat.

## #110 auth integration (draft PR #111; no HTTP auth yet)
- `workers/api/src/owner-learners.ts`: D1 read-only account-to-learner boundary requiring server-verified auth subject, active account/profile filtering and optional child scope; never accepts caller-supplied account ownership. Not wired to public routes until Better Auth sessions exist.
- `workers/api/tests/owner-learners.test.ts`: Node SQL parameterization/child-scope regression; `workers/api/tests/test_owner_queries.py`: Python SQLite integration against actual core migration and exact TypeScript SQL, synthetic only.
- `pnpm-lock.yaml`: pinned Better Auth/Drizzle dependency graph generated in one-time GitHub Actions; temporary resolver workflow removed. No schema, login, session, provider messaging or deployment is implemented.


## #46 native local runtime verification (branch-only)
- `scripts/cloudflare-local-smoke.sh`: disposable local Wrangler 4.45.0 D1 migration replay and Worker HTTP fail-closed smoke; no remote commands or real records.
- `.github/workflows/verify.yml`: adds independent `cloudflare-local-d1` job. Existing repository-policy, governance-tests and code-quality jobs are unchanged. Native local is not deployed staging.


## Cloudflare foundation (#104)
- workers/api/src/index.ts + bindings.ts: Workers request boundary; liveness, DB schema probe, all learner routes unavailable until auth integration.
- workers/api/src/authorization.ts: trusted server-input read/report policy; no HTTP login or client role parsing.
- workers/api/migrations/0001_core.sql: strict SQLite/D1 core relations, canonical metadata anchors and private-layer ownership constraints.
- workers/api/tests/: Node request/policy and Python SQLite migration, FK, transaction and SQL export/restore tests.
- workers/api/{package.json,tsconfig.json,tsconfig.build.json,wrangler.jsonc,README.md}: local module/types/build; local-only zero-ID D1 sample, no remote binding/deployment claim.
- docs/adr/0004-cloudflare-only-platform.md: owner-approved direction superseding old providers; docs/CLOUDFLARE_BACKUP_AND_RESTORE.md: recovery scopes, unconfigured export policy and rehearsal gates.
- Root scripts lint/typecheck/test/build now include API checks; .artifacts and .wrangler are local ignored state. Existing UI code/HTML/Quran assets are unchanged.

## Earlier map entries


## Current planning entry — 2026-10-29 (#101)
- `docs/LESSON_NOTEBOOK_AND_BACKEND_READINESS_PLAN.md`: consolidated Arabic notebook/backend-readiness plan; inspected baseline, shared reader UX, account/learner scope, proposed schema/API/versioning, atomic publication, media/privacy, classroom recovery, issue sequence and future test matrix.
- Current main includes the native Next.js app and student reader/training described in later entries. Foundation/branch-only descriptions below are historical; read PROJECT_STATUS current checkpoint first.
- Planning #101 creates no application module, migration, worker or deployment. Component/table/API names inside the plan are proposed responsibilities, not existing paths.

This is a **foundation-only repository**. The following existing paths are real:
- AGENTS.md: agent mandatory start.
- README.md: navigation and actual high-level status.
- PROJECT_STATUS.md: verified project continuity and next action.
- NOOR_MASTER_PLAN.md: agreed direction and unresolved decisions.
- CONTRIBUTING.md: Issue→PR→tests→merge policy.
- docs/ARCHITECTURE.md: proposed layer boundaries.
- docs/DESIGN_SYSTEM.md: owner-approved landing visual identity, tokens, components, section order, CTA and signup behavior.
- docs/ENGINEERING_GUARDRAILS.md: security/architecture invariants.
- docs/REPOSITORY_MAP.md: this authoritative map.
- docs/TEST_STRATEGY.md: verification matrix.
- docs/SECURITY_PRIVACY.md: minors / privacy constraints.
- docs/AI_HANDOFF.md: transfer instructions.
- docs/CI_BRANCH_PROTECTION.md: GitHub checks & settings procedure.
- docs/adr/: architecture decision templates and records, including ADR 0001 governance and ADR 0002 managed LiveKit Cloud + interactive mushaf.
- .github/workflows/verify.yml: initial real governance-only checks, conditional code quality once workspace exists.
- .github/scripts/verify_repo.py: repository policy gate.
- tests/governance/: tests for the gate.
- .github/ISSUE_TEMPLATE/: feature/bug/tech issue templates.
- .github/PULL_REQUEST_TEMPLATE.md: evidence checklist.
- .github/dependabot.yml: Actions dependency updates; npm added after scaffold.
- .github/CODEOWNERS: owner review hints (not enforcement without ruleset).
- .gitignore: prevents common local secrets and build artifacts.

## #39 bootstrap feature branch (pending PR review)
The following paths **exist on `feat/39-bootstrap-workspace` only**, and must not be represented as merged before CI and PR review:
- `package.json`, `pnpm-workspace.yaml`, `.npmrc`: pinned pnpm workspace and top-level test/build scripts.
- `apps/web/`: minimal Next.js App Router Arabic RTL application, not the final landing page.
- `apps/web/src/app/`: thin route composition, HTML language/layout and global brand tokens.
- `apps/web/src/features/bootstrap/`: one page-specific component and a render unit test.
- `apps/web/src/shared/ui/`: reusable stateless panel primitive.
- `scripts/check-architecture.mjs`: feature boundaries and cycles; `tests/architecture.test.mjs`: rules rejecting illegal imports.
- `scripts/smoke.mjs`: production Next server HTTP smoke (requires successful install and build).
- `scripts/browser-smoke.mjs`: Chrome DevTools Protocol browser gate at 360/390/1440, Arabic RTL and overflow checks, screenshot artifacts for human review.
- `artifacts/browser-smoke/`: generated screenshots in CI only; not source-controlled.
- `eslint.config.mjs`, `.prettierrc.json`, `apps/web/vitest.config.ts`: lint, formatting and unit test configs.
- `.env.example`: example with **no secrets**.

The real `pnpm-lock.yaml` is committed on this feature branch; frozen install, lint, typecheck, tests, build and HTTP smoke passed at SHA `392bff47` ([Verify 40680982177](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40680982177)). The Chrome browser smoke also passed on exact head `1f312a54` ([Verify 40694813876](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40694813876)); recheck CI on newer commits.

**Future directory proposal — NOT YET CREATED**
- apps/web/: Next.js frontend with mock contracts.
- workers/api/: Cloudflare Worker API gateway.
- workers/ai/: async AI planner.
- workers/state/: Durable Object classes.
- workers/sync/: Queues consumers.
- packages/contracts/: runtime validated DTOs.
- packages/ui/: shared components/tokens.
- packages/quran/: Quran data/player adapters.
- packages/training-engine/: deterministic interactive exercise runner.
- supabase/migrations/: schema changes.

Update this map IN THE SAME PR that creates, removes or moves directories; identify exact responsibilities and entry points, not merely list names.

## CORE-06 #44 — Student portal (M2 preview)
- apps/web/src/app/student/layout.tsx: route-level student shell, persistent across learner subpages.
- apps/web/src/app/student/page.tsx: academic learner overview.
- apps/web/src/app/student/[section]/page.tsx: lessons, mushaf, training, progress, notebook, subscription and account.
- apps/web/src/features/student/index.ts: sole public feature import API for routes.
- apps/web/src/features/student/domain.ts: typed learner, lesson, task and teacher-published report contracts, runtime checks, learner-scope filters.
- apps/web/src/features/student/mock-adapter.ts: isolated invented student fixtures and validated browser-session signup names, not live records or API.
- apps/web/src/features/student/StudentContext.tsx: active learner scoped state; per-learner checkbox state and no cross-learner reports.
- apps/web/src/features/student/StudentShell.tsx: account profile switching, responsive RTL sidebar/mobile navigation, explicit mock warning.
- apps/web/src/features/student/StudentDashboard.tsx: 50/50 academic home, no fake scores on new accounts.
- apps/web/src/features/student/StudentSection.tsx: route-specific detail pages and empty states.
- apps/web/src/features/student/components/{SchedulePanel,WirdPanel}.tsx: 7-day Cairo strip and local practice, respectively.
- apps/web/src/features/student/StudentPortal.module.css: scoped olive/gold/ivory responsive visual system.
- apps/web/src/features/student/student.test.tsx: fixture isolation, grade invariants, empty state tests.
- scripts/browser-smoke.mjs: original landing checks + student portal 360/390/1440 screenshot/interaction checks.
- apps/web/src/features/landing/v3/{LandingDemoProvider,DashboardModal}.tsx: transient same-tab learner profile handoff and portal link; landing stays authentic V3.
All functions are browser-local mock only; no sensitive backend credentials, no real enrollment/booking/teacher/media/payment.

## Student portal M2 continuation — page workflow components
- `apps/web/src/features/student/components/LessonHub.tsx`: scheduled/completed/all filters and expandable lesson detail actions (mock only).
- `apps/web/src/features/student/components/TrainingWorkspace.tsx`: teacher-approved exercise list, note drafting and explicit prepare-for-review state, no actual submission.
- `apps/web/src/features/student/components/ProgressWorkspace.tsx`: approved report timeline/criterion filter with independent memorization/recitation/tajweed grades and meaningful missing data.
- `apps/web/src/features/student/components/NotebookWorkspace.tsx`: selected completed lesson, published teacher summary, local learner-owned notes, no alleged cloud PDF.
- `apps/web/src/features/student/components/MushafWorkspace.tsx`: V3 fixture for verse marks, font-size and temporary notes; not a verified canonical Quran source.
- `apps/web/src/features/student/components/SubscriptionWorkspace.tsx`: bounded state display without fabricated payments/balances/renewal.
- `apps/web/src/features/student/components/AccountWorkspace.tsx`: same-account session demo profile creation, switching and confirmed removal.
- `apps/web/src/features/student/StudentContext.tsx`: per-learner notes, draft task state, verse selection and session profile actions; no server persistence.
- `apps/web/src/features/student/domain.ts`: sanitization and typed learner-local note contract.
- `apps/web/src/features/student/StudentSection.tsx`: route-to-component composition with profile key preventing transient cross-sibling text leaks.
- `apps/web/src/features/student/StudentPortal.module.css`: scoped responsive styles and controls.
- `apps/web/src/features/student/student.test.tsx`, `scripts/browser-smoke.mjs`: seven-route and interaction checks.

## STU-AZ S01 (student report table)
- `docs/STUDENT_PORTAL_A_TO_Z.md`: authoritative step-by-step implementation and delivery gates.
- `apps/web/src/features/student/reportHistory.ts`: approved-only newest-per-lesson stable sorting and five-row increment.
- `apps/web/src/features/student/reportHistory.test.ts`: revision/tie/order/null-grade/table SSR unit assertions.
- `apps/web/src/features/student/components/ProgressWorkspace.tsx`: accessible academic table + one in-row detail; no category filters/charts.
- `apps/web/src/features/student/components/ProgressTable.module.css`: scoped horizontally scrollable mobile academic table.
- `scripts/browser-smoke.mjs`: progress table keyboard-ready elements, expand and sibling isolation Chrome smoke.

## STU-AZ S02 attendance
- `apps/web/src/features/student/attendance.ts`: scoped attendance fixture, current record dedup, count categories, seven-day appeal cutoff, client-side attachment validation.
- `apps/web/src/features/student/attendance.test.ts`: expiry boundary, absence-only policy, updated record isolation and allowed evidence regression tests.
- `apps/web/src/features/student/components/AttendanceWorkspace.tsx`: count cards, RTL attendance table and local-only appeal preview; not a student-to-admin submission.
- `apps/web/src/features/student/components/AttendanceWorkspace.module.css`: mobile/desktop table and appeal form styles.
- `apps/web/src/features/student/components/ProgressWorkspace.tsx`: mounts attendance after independent academic history.
- `scripts/browser-smoke.mjs`: verify demo learner attendance, opening appeal UI, and new sibling's no-record state.

## STU-AZ S03 trial scheduling preference
- `apps/web/src/features/student/booking.ts`: trial length/price constants and validated preference + six-hour self-reschedule cutoff for real confirmed lessons.
- `apps/web/src/features/student/booking.test.ts`: one-trial eligibility, date preference validation and six-hour boundary tests.
- `apps/web/src/features/student/components/BookingWorkspace.tsx`: student Lessons wizard for local-only trial preferred weekday/window, zero cost, teacher auto-assignment pending server, optional weekly paid preference preview, no fake booking submission.
- `apps/web/src/features/student/components/BookingWorkspace.module.css`: RTL/responsive booking/review interface.
- `apps/web/src/features/student/components/LessonHub.tsx`: compose existing schedule and booking preview.
- `apps/web/src/features/student/StudentDashboard.tsx`: link new learner CTA into the booking workflow rather than dead-end notice.
- `scripts/browser-smoke.mjs`: S03 trial review, no-send and sibling isolation.

## STU-AZ S04 Quran reader source structure
- `apps/web/src/features/student/quranSource.ts`: typed Hafs source adapter for 604 SVG pages and sidecar / verse text metadata; safe page clamp and surah:ayah reference extraction.
- `apps/web/src/features/student/quranSource.test.ts`: source URL, 604-page bounds, metadata validation, no invented ayah text.
- `apps/web/src/features/student/components/MadinahReader.tsx`: full native React reading modes, page controls, source fallback, metadata-driven ayah selector and local notes.
- `apps/web/src/features/student/components/MadinahReader.module.css`: responsive RTL page and ayah presentation.
- `apps/web/src/features/student/components/MushafWorkspace.tsx`: thin student route composition; replaces earlier illustrative four verses.
- `scripts/browser-smoke.mjs`: S04 Chrome tests for 604-page controls, alternate mode and sibling reset.
- `docs/QURAN_ASSETS_DEPLOYMENT.md`: pinned source provenance, Santo cross-repo workflow, live verification and security boundary.

## Quran UX (#85)
- `components/SmoothMadinahPage.tsx` and CSS: decoded SVG swap, fixed sheet geometry, memory-bounded page preload and pinned fallback.
- `components/QuranInk.tsx` and CSS: separate normalized page ink, pen/marker/eraser, S Pen vs touch pointer mode.
- `quranAnnotations.ts`: typed learner-scoped note/word/ayah model and published teacher note gate.
- `quranSearch.ts`, `components/QuranSearchPanel.tsx` and CSS: search full 6236 Hafs ayat with authoritatively verified page markers.
- `components/MadinahReader.tsx` and CSS: immersive controls, anchored highlights, all notes jump, search integration and mobile next/previous.
- `quranReading.test.ts` and browser smoke: bounded preload, Arabic normalization, note isolation, stable layout and visible controls.

## Quran reader native components and route layout
- `StudentShell.tsx`, `StudentSection.tsx`, `components/MushafWorkspace.tsx`: remove dashboard chrome and panel wrappers specifically for the Mushaf route.
- `quranReaderLayout.ts` and test: desktop physical spread `[2,3]`, `[4,5]` etc with opening page alone and single-page responsive override.
- `components/ReaderPrintedPage.tsx`: fetch verified publisher sidecar for EACH visible printed leaf; compose `SmoothMadinahPage`, `QuranInk` and `QuranAyahOverlay` to keep click targets accurate on both spread pages.
- `components/MadinahReader.tsx` and CSS: own Noor visual design, compact toolbar, large page canvas, index drawer for surahs/bookmarks/notes, preferences for single/double/auto and swipe mode; original source text unchanged.

## Quran reciters playback modules (#92)
- `quranReciters.ts`: six Hafs Murattal reciters with verified EveryAyah public audio path, validated `001001.mp3` format, per-page/per-surah/per-ayah queues and audio time formatter.
- `components/QuranRecitationPlayer.tsx`: accessible HTMLAudioElement, active ayah callback, error/buffering/seek/progress, prev/next, speed and repeat count, single audio dock without backend.
- `components/QuranRecitationPlayer.module.css`: mobile horizontal compact controls and stable page-first layout.
- `quranReciters.test.ts` and `scripts/browser-smoke.mjs`: source IDs, no invented missing ayah, player six reciter selector and no autoplay.

## Quran mobile page-first controls (#94)
- `components/QuranRecitationPlayer.tsx` + CSS: compact audio dock, separate advanced listening options controlled by `aria-expanded` and floating panel, all existing six qaris, page/surah/ayah sequences, repeat, speed and seek preserved.
- `components/MadinahReader.tsx` + CSS: actual collapsible one-row icon toolbelt, smaller header/footer, correct dynamic Quran canvas sizing with audio open; no additional media calls or backend.
- `scripts/browser-smoke.mjs`: 375×667 compact player visual/geometry and all-feature options checks with screenshot.

## Quran stylus/mobile and classroom canonical views (#97)
- `quranInteraction.ts` + tests: same-key rapid double-tap semantics, separate word and verse keys.
- `components/QuranInk.tsx` and CSS: capture touch/pen/mouse drawing, SVG transparent hit rect, `touch-action:none` only in draw modes, cancellation-safe ink with normalized SVG coordinates.
- `components/QuranAyahOverlay.tsx` and `components/ReaderPrintedPage.tsx`: accurate source polygon selection on one tap and note editor on second or keyboard Enter.
- `components/SmoothMadinahPage.tsx` and CSS: fixed-ratio decoded image swap with short optional turn-sheen animation, reduced-motion preference, no image text manipulation.
- `components/MadinahReader.tsx` and CSS: vertical floating pen palette under icons, 5 colors, eraser, undo/redo, browsing, no extra horizontal tools or page reflow.
- `docs/QURAN_CANONICAL_MUSHAF_AND_LESSON_VIEWS.md`: future immutable lesson snapshot filtered through same renderer; one original student Mushaf accumulates approved teacher marks, separated from sibling profiles. Backend deferred.

## Training frontend (#99)
- `components/TrainingWorkspace.tsx` + `.module.css`: three accessible panels, local learner-scoped homework drafts/prepared toggles, free practice samples, booked lesson preparation.
- `components/TrainingQuranSession.tsx`: focused same `ReaderPrintedPage` Quran source viewer and publisher-verified ayah text hide/reveal, existing Quran reciter for selected verse.
- `components/TrainingVoicePractice.tsx`: explicit browser-only mic opt-in and private blob playback, no backend storage.
- `quranAssignment.ts` + tests: structured surah/from/to/page and demo references; reject scope string guessing, nearest booked lesson.
- `components/QuranAyahOverlay.tsx` and `components/ReaderPrintedPage.tsx`: optional allowed/focus verse keys for task-specific view; default full Mushaf behaviour unchanged.



## Classroom teacher-eligibility guard (PR #121, Issue #120)
- `workers/api/migrations/0003_teacher_schedule.sql` also validates active/qualified acting teacher for newly scheduled reservations and reactivation/reassignment; historical completion remains possible after a teacher is disabled.
- `workers/api/tests/test_teacher_calendar.py` covers disabled/unqualified insert denial, canceled reactivation, atomic teacher reassignment and historical completion. This is a SQL invariant, not full authenticated scheduling or teacher presence authorization.

## Proposed classroom schedule foundation (PR #121, Issue #120)

- `workers/api/migrations/0003_teacher_schedule.sql`: additive 40-minute lesson occupancy constraint; D1 triggers reject same-teacher or same-learner overlapping bookings even on cancellation/reactivation/rescheduling, and keep legacy bookings untouched.
- `workers/api/tests/test_teacher_calendar.py`: SQLite regression coverage for adjacency, collisions, status changes, scheduling edits, legacy migration and `core` readiness metadata.
- This slice does not introduce media, live pen sync, teacher or learner booking HTTP routes. Next implementation should use authoritative D1 with authenticated actors and layer on classroom LessonDO; see #7/#120.


## Classroom lifecycle contract / immutable ledger (implementation #120)

- `workers/api/src/classroom/lifecycle.ts`: portable teacher-only Start/End policy with verified room presence input, no auto-close, 30m instructional / 40m reservation display-only thresholds.
- `workers/api/migrations/0004_classroom_lifecycle.sql`: additive append-only D1 teacher Start/End event ledger (unique per lesson, actor check, order and restore-friendly).
- `workers/api/tests/classroom-lifecycle.test.ts` and `test_classroom_lifecycle_ledger.py`: role, presence, time boundary, event-order, actor, immutability and restore regression.
- **Not a running classroom**: verified Worker/DO presence, atomic lifecycle service API, video provider and UI remain separate build slices.


## Verified teacher and learner lesson calendar (PR from #120)

- `workers/api/src/lesson-calendar.ts`: explicit D1 teacher/learner calendar SQL with active teacher qualification, assignment/consent grant checks, and account+learner scoped reads. No private content.
- `workers/api/src/auth/routes.ts`: new authenticated `GET /v1/teacher/lessons` before ownerAccount (avoids synthetic owner account creation for teacher), and `GET /v1/me/learners/:id/lessons` after verified profile ownership.
- `workers/api/tests/test_lesson_calendar_queries.py`: actual SQLite execution of queries extracted from TS, with cross-account, revoked grant, substitute consent and archive exclusions. No media token or teacher Start/End routes in this slice.


## Teacher portal — teacher-first full React preview (#45, #120)

- `apps/web/src/app/teacher/{layout,page}.tsx` and `[section]/page.tsx`: thin Next static-export routes, generated sections for Sheikh workspace.
- `apps/web/src/features/teacher/index.ts`: only public import surface. `TeacherShell.tsx` + `TeacherPortal.module.css`: RTL ivory/green/gold desktop/mobile navigation, preview disclosure, notifications and scenario picker.
- `domain.ts` / `fixtures.ts` / `TeacherContext.tsx`: typed classroom-timetable, report, task, case DTOs; synthetic-only preview scenarios; explicit no-send local mutation state and validation. Not an authenticated teacher backend.
- `TeacherHome.tsx`, `TeacherStudents.tsx`, `TeacherSchedule.tsx`, `TeacherPreparation.tsx`: real modular overview, roster with independent academic plan and substitute brief, 40-minute teacher schedule, pre-lesson preparation.
- `TeacherReports.tsx`, `TeacherAssignments.tsx`, `TeacherNotifications.tsx`, `TeacherCases.tsx`, `TeacherUI.tsx`, `TeacherSection.tsx`: independently scored editable report/preview/approve **mock**, per-student Quran-range task creation and recitation review **mock**, notifications and attendance/exception previews.
- `apps/web/src/features/teacher/teacher.test.tsx`: SSR/policy/role/grade/assignment/state tests. `scripts/browser-smoke.mjs`: Arabic RTL teacher route, 360/390/1440px screenshot and empty teacher scenario smoke.
- `docs/TEACHER_PORTAL_BACKEND_CONTRACT.md`: explicit per-route Worker/D1/DO contract, UI scenario-to-backend acceptance matrix, privacy and role checks, future implementation order.
- **NOT IMPLEMENTED:** production teacher provisioning, server mutations, LiveKit room, authorized class Start/End HTTP, database report publication, private audio playback, WhatsApp or classroom UI.


## Interactive classroom Quran-first React preview (#50, after #126 Sheikh portal)

- `apps/web/src/app/classroom/page.tsx` and `features/classroom/index.ts`: Next static page & public feature boundary. **Synthetic preview**, not secure classroom admission.
- `features/classroom/ClassroomPreview.tsx`: classroom composition around original `features/student/components/ReaderPrintedPage.tsx` via student public index; no duplicated Quran source or screenshot-based lesson storage.
- `features/classroom/ClassroomControls.tsx`: two-person prejoin simulation, Sheikh-only explicit Start/End, 30/40-minute notify-only, authorized UI page navigation, teacher-student draw modes, student mic permission/mute.
- `features/classroom/ClassroomMedia.tsx`: student docked video placeholder, movable/resizable float and teacher local self-preview hide vs camera-off, with NO actual camera/LiveKit room.
- `features/classroom/ClassroomSidePanel.tsx`: per-ayah teacher corrections, private notes, nullable three scores and author-aware shared ink moderation/audit; `useClassroomPreview.ts` + `domain.ts` local preview state/policy only.
- `features/classroom/Classroom.module.css`: RTL responsive Quran-first three-column shell, mobile order and floating controls.
- `features/classroom/classroom.test.tsx` and `scripts/browser-smoke.mjs`: unit/SSR policy and real Chrome controls, source Quran page, no overflow at 360/390/1440.
- `features/student/index.ts`: exports canonical reader / ink types / page helpers for reuse by classroom without cross-feature internal imports.
- `features/teacher/TeacherShell.tsx` and `TeacherPreparation.tsx`: demo-only link to classroom; authenticated live Start remains disabled.
- `docs/CLASSROOM_UI_BACKEND_CONTRACT.md`: future authorized per-lesson Worker/D1/DO and LiveKit token interfaces, 30/40 timing, replay, audit and privacy test matrix. No claims of real video, saving or room access.


## Classroom session access-only Worker API (#50)

- `workers/api/src/classroom-access.ts`: D1 SQL + typed response fields to prove an authenticated acting teacher or selected owned child can view the particular scheduled/live classroom appointment. No presence/room/media permission is issued; no private notes, phone or raw audio selected.
- `workers/api/src/auth/routes.ts`: routes `GET /v1/teacher/lessons/:id/access` before owner account creation and `GET /v1/me/learners/:childId/lessons/:id/access` through verified owner context. Both deny unknown/canceled/ended lessons with 404.
- `workers/api/tests/test_classroom_access.py`: exact SQL extraction and real SQLite migration lineage tests, with revoked/substitute consent, disabled teacher/owner, cross-child and terminal-state denials.
- **Still absent:** per-lesson DO membership/replay, verified real-time presence, teacher Start/End write endpoint, LiveKit tokens and video. See `docs/CLASSROOM_UI_BACKEND_CONTRACT.md`.

## Owner-approved dense Quran classroom implementation (2026-10-29)

- `docs/CLASSROOM_APPROVED_DENSE_LAYOUT.md`: final approved desktop-teacher/mobile-student layout and strict no-fake-Quran/media acceptance constraints, originating from owner approval of the two design mockups.
- `apps/web/src/features/classroom/ClassroomControls.tsx`: compact title/status, two-party lobby + small expandable demo clock, one compressed navigation and drawing toolbar; correct page range 1..604.
- `apps/web/src/features/classroom/ClassroomPreview.tsx`: teacher-only lateral Quran page controls reuse previously unoccupied whitespace, without changing Quran source/rendering.
- `apps/web/src/features/classroom/ClassroomSidePanel.tsx`: private notes available beside nullable grade inputs without unnecessary panel switching.
- `apps/web/src/features/classroom/Classroom.module.css`: compact 100dvh layout, panels/video fill their allocated height, student mobile Sheikh camera first and canonical Quran second.
- `apps/web/src/features/classroom/classroom.test.tsx`: semantic assertions for approved control structure and accurate demo state. Staging and LiveKit remain separate release gates.
