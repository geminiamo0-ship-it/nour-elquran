## Classroom #221 — late LiveKit startAudio cleanup after Stop (source candidate; 2026-10-30)
- Draft PR #226 now snapshots old remote audio elements **before** `Room.startAudio()`; if its internal playback resolves/rejects after Stop removes the DOM nodes, the old elements are paused without touching a replacement Room. Existing explicit `audio.play()` race cleanup retained. Added synthetic deferred resolve/reject tests in `media-device-safety.test.ts`. Exact-head Verify and real signed two-browser Cloudflare Dev/physical camera-mic QA remain required; do not merge, deploy Production or claim device acceptance.

## Classroom #221 — subscribed audio autoplay after Stop (source candidate; 2026-10-30)
- PR #226 now guards the **TrackSubscribed audio element autoplay**, not only the explicit audio-resume button: an in-flight `play()` settling after leave pauses its captured old element, never the new Room; stale autoplay rejection does not surface an error. Four synthetic Vitest cases added. This is **unverified source until exact-head Verify completes**; no signed two-browser Cloudflare Dev or real hardware QA. Keep Draft, do not merge or deploy Production.

## #221 — late remote audio play after Stop (source candidate, 2026-10-30)
- Draft PR #226 now captures each HTML audio element for manual resume and pauses that exact element if an in-flight `play()` settles after Stop/leave or Room replacement. Prevents a delayed old-room play from undoing teardown without touching the new room. Two synthetic deferred resolve/reject regressions added. **Exact-head Verify and signed two-browser Cloudflare Dev hardware/audio QA pending**; no Production, child data, recording or provider secrets.

## #221 — remote audio/video teardown on Stop and participant disconnect (source candidate, 2026-10-30)
- Draft PR #226 now explicitly pauses attached remote audio/video, clears their MediaStream references and removes elements on Stop/leave, provider disconnect, participant disconnect and TrackUnsubscribed. DOM removal alone is not relied on to stop playback. Three synthetic cleanup tests cover audio/video, failed pause and failed stream release. **New exact-head CI and two-browser real-device QA required**; no Production, child data or recordings.

## #221 — unexpected LiveKit disconnect capture teardown (source candidate, 2026-10-30)
- Draft PR #226 now synchronously stops all old Room local tracks on explicit Stop and unexpected provider Disconnected, then best-effort requests independent microphone/camera disable. This closes a privacy gap where a provider drop cleared the UI but might leave a local device capturing. Two synthetic teardown tests added. **CI for this new commit and real signed two-browser Cloudflare Dev device indicators remain unverified**; no merge, Production, child data, or recording.

## #221 follow-up — stale LiveKit Room event invalidation (source candidate, 2026-10-30)
- Draft PR #226 now invalidates the Room generation on unexpected provider disconnect and requires both exact Room identity and generation for reconnect, track subscribe/unsubscribe, participant events and post-connect success. Prevents a queued old-Room track or late connect completion from repopulating a new room or falsely reporting connected. Two synthetic room-event gate tests added. **New exact-head Verify and real two-browser Cloudflare Dev permission/rejoin QA still required**; no Production, minors, recording or keys.

## #221 follow-up: guard stale remote audio and Sheikh mute UI (source candidate, 2026-10-30)
- Draft PR #226 prevents pending old-Room `startAudio()` from playing a **new Room's** audio after Stop/rejoin, suppresses stale remote autoplay failure notices and stale Sheikh mute HTTP result messages, and resets busy state on provider disconnect. Three synthetic deferred/audio-order tests added. Exact-head GitHub Verify and real signed Cloudflare Dev two-browser permission/audio QA remain required; no Production or private recordings.

## #221 follow-up: stale rejected LiveKit device-enable cleanup (source candidate, 2026-10-30)
- Draft PR #226 adds best-effort `setDeviceWithEpochGuard` cleanup when an enable promise **rejects after the Room becomes stale**, covering SDK failure after partial camera/mic capture. Disable is bound to the captured old Room; preserve original error even if cleanup fails. Three synthetic Vitest regressions: partial capture+rejection, cleanup rejection, and no extra disable for current permission rejection. This is a source candidate: exact-head Verify and real signed browser device/permission QA still required; no Production, no recording, no real children.

## #221 — signed LiveKit device-permission race guard on current main (SOURCE CANDIDATE, 2026-10-30)
- New focused branch `fix/221-livekit-permission-race-on-current-main` applies the Stop/leave asynchronous camera/microphone permission cleanup to the **already merged approved** `LiveClassroom` implementation on main, rather than merging stale Draft PR #222's competing classroom layout. `LiveLessonMedia.tsx` captures Room identity and epoch for each toggle, ignores stale UI updates, stops a late local video/**audio** track and best-effort disables the old participant after leave. Synthetic deferred-promise tests cover late camera, microphone, stale disable, rejected permission and current toggles. **Exact-head Verify #41026082487 passed 4/4 on previous head `baf48136`; new edge-case regression tests at `86f62f51` need a fresh exact-head run.** Real device QA still pending. Staging must recheck user-initiated opt-in, Stop/leave and camera/mic indicator after pending permissions; no Production or child media.

## CR-02B2 #206 — Signed staff immediate DO wake + Sheikh mic mute source/Dev accepted (2026-10-30)
- Noor [PR #209](https://github.com/geminiamo0-ship-it/nour-elquran/pull/209) merged `812525274ceb549797f8ab821a38804839c81c04`, exact main [Verify #41002079116](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41002079116) **4/4 PASS**. Santoreno [PR #269](https://github.com/geminiamo0-ship-it/santoreno/pull/269) merged `c55b621499a0901a67cdec3c65245a7254c697ea`; [isolated Dev #41002323938](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41002323938) SUCCESS: Sheikh signed mute 503/no provider secrets, forged unmute/track/room 400, learner 404, anonymous 401; prior CR-01/CR-02A/07A/08A/08B1 PASS. Immediate DO reconcile after signed D1 staff suspension/dequalification/cancellation, and Sheikh-only server-fetched microphone SID `muted:true` now in source. **No real LiveKit provider ACK/two-device AV or signed End API**; #206 OPEN, Production media OFF. See `docs/CLASSROOM_CR02B2_WRITE_MUTE_DEV_ACCEPTANCE.md`. Admin LAST.

## CR-02B2 #206 — direct signed staff write-time media wake + Sheikh microphone-only mute (SOURCE CANDIDATE)
- `feat/206-livekit-writetime-mute`: staff D1 committed suspend/revoke qualification wakes only affected real lesson DO immediately; staff cancel wakes its booked lesson DO. Internal reconcile path is DO binding only, not public API; response is **wake requested** not provider ACK. Teacher-only signed POST empty `{}` to mute exact learner microphone via server-fetched LiveKit ListParticipants track SID and MutePublishedTrack `muted:true`; no remote unmute, camera or screen-share control, browser track ID, recording or provider credentials. Signed teacher and DO heartbeat required. Tests and contract `docs/CLASSROOM_CR02B2_WRITE_MUTE_CONTRACT.md`. No real End write API yet; no provider A/V test, no Production. #206 remains OPEN; Admin Dashboard LAST.

## CR-02B2 #206 — first server-only LiveKit eviction slice merged; only source verified (2026-10-30)
- [Noor PR #207](https://github.com/geminiamo0-ship-it/nour-elquran/pull/207) merged `6a490efea53fec243facf09b5e5489910cd48b3b`, exact head Verify #40999824319 and postmerge main [#40999944470](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40999944470) **4/4 PASS**. Durable DO media-intent before join ticket, 10s alarms/D1 lease+right checks, persistent retry outbox with same-actor rejoin fence, room-specific 60s admin JWT LiveKit RemoveParticipant + explicit revocation cutoff. Provider API was **NOT** called; credentials absent, no instant write-time revoke or real two-device safety proven. Santoreno Dev no-secret PR #267 merged and its smoke is separate. See `docs/CLASSROOM_CR02B2_SOURCE_ACCEPTANCE.md`; issue #206 still OPEN. Admin Dashboard LAST.

## CR-02B2 #206 — DO media eviction alarm + LiveKit RemoveParticipant durable outbox (SOURCE ONLY)
- New `livekit-admin.ts` server-only HTTPS Twirp RemoveParticipant with 60s room-scoped admin JWT and explicit `revoke_token_ts`, same HMAC room/identity as join token; no remote provider room/credentials configured. LessonDO media-intent is persisted **before** a client join token is minted, and 10s alarms reconcile D1 qualified acting Sheikh/owned learner and 25s room leases. Revoked/expired/end/leave actor identity queued durably; provider fail/timeouts retry, pending same-actor rejoin denied. **Not instantaneous; no provider ACK/Dev integration accepted yet**, direct write-time revocation hooks, teacher mute and real two-device Cloud acceptance still open. See `docs/CLASSROOM_CR02B2_PROVIDER_EVICTION_CONTRACT.md`. Admin Dashboard LAST.

## CR-02B1 #204 — browser LiveKit opt-in media client (SOURCE ONLY; provider and two-device test NOT accepted)
- `feat/204-livekit-browser-media` adds pinned `livekit-client@2.23.0` + reproducible lockfile, strict worker media-token POST client and lazy SDK in signed `/classroom/live` UI only after LessonDO waiting-room join. Default mic/camera OFF; separate opt-in buttons, remote audio/video, reconnect/disconnect and media track cleanup, Arabic RTL availability. No recording, remote unmute, formal attendance, synced Quran, LiveKit project/real media or Production. **Real LiveKit server-side participant eviction on revocation/End is NOT yet implemented**, so media release is blocked pending CR-02B2. See `docs/CLASSROOM_CR02B1_MEDIA_CLIENT_CONTRACT.md` and #204. Admin Dashboard LAST.

## CR-02A #200 — LiveKit media-token issuer source + isolated Dev no-secret fail-closed ACCEPTED (2026-10-30)
- Noor [PR #201](https://github.com/geminiamo0-ship-it/nour-elquran/pull/201) merged `d231568d84748d5a16f0b496fbb0dad76898a084`, main [Verify #40996405754](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40996405754) 4/4 success. Signed worker gateway enforces D1 acting Sheikh/owner and exact participant LessonDO heartbeat; WebCrypto HS256 JWT 120s, opaque identity, camera/mic-only grants, no recording/admin/data. Santoreno [PR #265](https://github.com/geminiamo0-ship-it/santoreno/pull/265) merged `6f98b8e0acf063608d156e3d4cff56225de6574a`; [real Dev #40996681563](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40996681563) SUCCESS: signed active teacher+learner 503/no token without LiveKit secrets, forged 400, outsider 404, anonymous 401, GET 405; CR-01/07A/08A/08B1 regressions PASS. **No LiveKit account/credentials, provider A/V, device test, revoke-connected-user flow, recording or Production.** Evidence `docs/CLASSROOM_LIVEKIT_CR02A_DEV_ACCEPTANCE.md`. CR-02B next, Admin Dashboard last.

## Classroom CR-02A #200 — LiveKit token-only backend candidate (source, NOT provider-connected)
- `feat/200-livekit-token-gateway`: server-only Web Crypto HS256 LiveKit Cloud JWT POST for signed verified Sheikh or owner of learner after fresh D1 scope **and matching LessonDO lease heartbeat**; 120s initial-join token, opaque role+lesson identity, camera/mic publishing only, no room admin/record/data, no secrets committed, no media tracks or Production. Without actual LiveKit secrets returns safe 503 and does not issue a token. See `docs/CLASSROOM_LIVEKIT_CR02A_TOKEN_CONTRACT.md`; #200 must pass exact-head Verify before merge, then isolated Dev disabled-config check. CR-02B LiveKit real two-device media/revocation/consent still open. Admin Dashboard LAST.

## CR-01 #196 — signed Classroom waiting-room DO API accepted on isolated Dev (2026-10-30)
- Noor [PR #197](https://github.com/geminiamo0-ship-it/nour-elquran/pull/197) merged `dfbe6d68c6817c2022cf7a1c17fad4906b922981`, [main Verify #40993668189](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40993668189) 4/4 PASS. Santoreno [PR #263](https://github.com/geminiamo0-ship-it/santoreno/pull/263) merged `c3653398a786e0a7c182caa32ac55e4dcc68e2a2`, [real isolated Dev #40994099005](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40994099005) PASS: SQLite DO bound to noor-site-staging, two independently authenticated accounts, 25s lease, role/foreign/anon denial, no lifecycle Start, no LiveKit/AV or real data. `docs/CLASSROOM_CR01_DEV_ACCEPTANCE.md` is canonical proof. PR #199 refines React StrictMode UI; targeted human/Chrome RTL/mobile QA pending. Classroom media/token/Quran sync + true Start/End remain open #49/#50/#120/#194. Admin Dashboard last.

## Classroom CR-01 #196 — source candidate for signed DO waiting-room presence (NOT Dev accepted)
- On `feat/196-classroom-waiting-room-do`: SQLite-backed LessonRoom DO class, local Wrangler binding/migration, actual site Worker class export, signed Better Auth owner/acting Sheikh presence GET and explicit join/heartbeat/leave POST, TTL 25s and fail-closed if DO unavailable. New `/classroom/live` waiting room and teacher/learner verified schedule links; public `/classroom` remains labelled demo. **No LiveKit tokens/audio/video, real Classroom Start/End, Quran streaming, media or Production**. See `docs/CLASSROOM_WAITING_ROOM_CR01_CONTRACT.md`; #196 open pending exact-head Verify + isolated two-account Dev DO proof.

## Phase 08B1 #192 — isolated Cloudflare Dev owner archive read security ACCEPTED (2026-10-30; no real Classroom source)
- [Noor PR #193](https://github.com/geminiamo0-ship-it/nour-elquran/pull/193) merged `5ac9561d4db957b605d609e9ab4677a5c92375c7`; [main Verify #40990456089](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40990456089) 4/4 SUCCESS. Immutable Quran-archive manifest/pages/marks D1 migrations 0015/0016, owner-only API, strict read-only Quran renderer implemented.
- [Santoreno PR #261](https://github.com/geminiamo0-ship-it/santoreno/pull/261) merged `f320a4b7e90e201179e7a9eca432af73073c304d`; [real isolated Dev #40990589139](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40990589139) SUCCESS. Synthetic signed owner 200/null unsealed, foreign 404, anonymous 401, POST 405; no fake teacher marks, 07A/08A regressions PASS.
- **NOT real Classroom integration:** no DO snapshot exporter, teacher live strokes, verified digest seal, PDF or Production; targeted visual acceptance still outstanding. #194 tracks DO source, #192/#102/#155 remain open. See `docs/PHASE_08B1_DEV_ACCEPTANCE.md`. Admin Dashboard stays LAST.

## Phase 08B1 #192 — sealed lesson Quran archive read-only foundation (source only, NOT Dev accepted)
- Following Dev-accepted 08A [Santoreno #40988644083](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40988644083) SUCCESS: signed synthetic private notebook notes create/replay/edit/hide with owner/foreign 404 and existing regression passes. Phase 08A API accepted on Dev; owner visual UI still outstanding.
- New `feat/192-lesson-quran-archive-read`: D1 0015 immutable canonical page+teacher mark archive per published report revision, only sealed DO-provenance envelope visible to signed student household through owner GET `/v1/me/learners/:learnerId/lessons/:lessonId/quran-archive`. Frontend uses existing Quran page and ink renderer read-only with strict parser; pending unavailable unless real seal exists. **No public ingest, no real Classroom DO checkpoint producer, no PDF/PNG, no child data, no Production and no source/remote Dev acceptance yet.** See `docs/LESSON_QURAN_ARCHIVE_08B1_CONTRACT.md` and #192. Admin Dashboard remains final project stage.

## Phase 08A #190 — connected learner notebook private notes (source branch; NOT Dev accepted)
- `feat/190-notebook-private-notes` adds additive D1 `0014_notebook_private_notes.sql`: private free-text journal distinct from existing Quran ink, immutable event log and revisioned visible note projection; only verified owner of the requested learner and authoritative completed+END lesson may mutate.
- Better Auth GET/POST `/v1/me/learners/:learnerId/lessons/:lessonId/notebook-notes`, UUID idempotency and CAS; connected student Notebook reuses the genuine learner lesson calendar and Phase 07A latest approved reports, honest pending-report/archive-unavailable; original demo remains distinct.
- **No merged/Dev/Production acceptance claimed** until exact-head Verify, cloud Dev synthetic ownership/CAS/refresh and targeted browser visual. No duplicated private Quran annotations, R2 PDF, Classroom live snapshot, child audio, Admin booking or subscriptions. Owner visual QA remains optional and scoped. Related #190, #102, #155.

## Phase 07A #186 — authenticated reports on isolated Cloudflare Dev ACCEPTED (2026-10-30; API ONLY)
- [Noor PR #187](https://github.com/geminiamo0-ship-it/nour-elquran/pull/187) merged `fedc03a8aa89e04a8080e5210840a93bf900027c`; [main Verify #40986308630](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40986308630) **4/4 PASS**.
- Santoreno [PR #257](https://github.com/geminiamo0-ship-it/santoreno/pull/257) merged `4b267a852401a527699084b3e8357642b5a54a98`; [real Noor Dev #40986426733](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40986426733) **SUCCESS**: exact Noor main SHA verified; migration 0013 applied to `noor-core-staging`; `noor-site-staging` Worker+UI deployed. Signed synthetic authorized staff booked a lesson; test-only D1 lifecycle Start/End emitted after booking (no real classroom media/presence claim). Verified Sheikh draft save/replay/stale, private owner projection, publish and republish, prior approved during new draft, independent nullable scores, latest-only approved version, foreign owner/anonymous denial and revoked teacher 404; other Phase 05A/05B/06A1 regressions PASSED.
- **Not yet end-to-end UI released**: no targeted Chrome owner visual QA, genuine Classroom/DO participant presence or real live END event, archive/PDF linkage, notifications or Production. No real child voice or staff payments. Phase 07A API acceptance ≠ complete Phase 07 product. #186 stays open for connected Sheikh/student UI acceptance; #51/#155 OPEN. Admin Dashboard stays LAST (ADR 0008).

## Phase 07A #186 — source implementation (2026-10-30, NOT Dev accepted)
- Working branch `feat/186-lesson-reports-d1`: new D1 migration 0013 for immutable teacher draft events, approved snapshots and latest publication pointer; Better Auth scoped `GET/POST /v1/teacher/lessons/:id/report[/-actions]`, owner `GET /v1/me/learners/:id/reports`. Real completed lesson + authoritative END audit required. Signed acting Sheikh only; primary-at-lesson or accepted substitute; independent 0–10/null scores and CAS/idempotency.
- Connected reports UI for Sheikh and approved-only student progress; signed-in mode never falls back to demo. Source tests and staged acceptance still required; **no CI PASS, remote D1 migration, Chrome visual proof, deployed API, Classroom, Admin Dashboard or Production claimed** from this change.
- Owner delivery update: **Admin Dashboard is built LAST**, owning teacher invitation+approval/activation, booking, financial operations and learner assignment; see ADR 0008. No public Sheikh signup promotion. Remaining Phase 07A gate: exact-head Verify, real synthetic Cloudflare Dev migration/HTTP/role proof and targeted UX acceptance. #155/#51 remain open.

## Phase 06A1 #180/#182 — Dev privacy-denial gate ACCEPTED (2026-10-30)
- Noor [PR #183](https://github.com/geminiamo0-ship-it/nour-elquran/pull/183) merged at `a64ebd75c4543fa4d082f0aa93a6c93286da16d0` (postmerge [Verify #40977815438](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40977815438) PASS); security hardening [PR #184](https://github.com/geminiamo0-ship-it/nour-elquran/pull/184) merged `8cee3a6dbc6b439564fbaa6d5af4560519b35693` (postmerge [Verify #40978899148](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40978899148) 4/4 PASS).
- **Actual isolated Cloudflare Dev migration + signed Better Auth API accepted**: [Santoreno #254](https://github.com/geminiamo0-ship-it/santoreno/issues/254), [PR #255](https://github.com/geminiamo0-ship-it/santoreno/pull/255), [Dev deploy/test #40979386785](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40979386785) SUCCESS. D1 `0012` consent-grant/upload lock triggers exist; no audio assets. Owner's two synthetic children GET policy 200 disabled, foreign owner 404, signed-out 401, grant POST 405; 05A/05B task/review regression PASS. Chrome intentionally OFF.
- **Only denial and preparation accepted, NOT audio availability**: no R2 bucket, upload/playback, guardian identity verification, approved retention/delete/export or real student/Production audio. Parent #180 OPEN; owner performs separate #173/#178 visual acceptance. Earlier “source only / stage pending” sections below are historical and superseded by this Dev evidence.

## Phase 06A1 #180 — runtime media-envelope hardening (2026-10-30; draft)
- Branch `fix/180-private-audio-runtime-guards` revalidates the **entire** audio descriptor when building an opaque private R2 key (not only asset ID/type), rejects non-string learner IDs, and refuses unsupported runtime MIME values before constructing playback headers. Added negative Node tests for forged submission, oversized media, invalid digest/duration, MIME and coerced learner ID.
- This is **defense-in-depth source only**: no R2 bucket, upload/playback endpoint, guardian consent activation, policy approval, remote D1 write or Production change. Exact-head fast Verify and review are required; #180 stays OPEN pending identity, retention/deletion/export and private R2 acceptance.

## Phase 06A1 #182 — privacy-first audio source scaffold (2026-10-30)
- Introduced proposed **additive locked** `0012_recitation_audio_privacy.sql` and server-only descriptor/key validation `private-recitation-audio.ts` with test coverage; D1 explicitly rejects guardian grants and audio asset inserts, including accidental SQL-side bypass. Owner-scoped `GET /v1/me/learners/:id/recitation-audio-policy` returns disabled only. See [private audio contract](docs/PRIVATE_RECITATION_AUDIO_CONTRACT.md).
- **Not enabled, not R2-deployed, not legal/privacy approved**: no uploads/playback, real guardian verification, retention/deletion policy, production recordings or R2 bucket. Parent #180 stays OPEN. Exact-head CI/merge and Dev migration evidence must be separately recorded; do not confuse source with runtime acceptance. Owner handles prior #173/#178 visual QA.

## STATUS UPDATE — Phase 05A/05B on isolated Dev, 2026-10-30
- **05A teacher publish → student homework API/D1 ACCEPTED ON DEV**: Noor main [PR #176](https://github.com/geminiamo0-ship-it/nour-elquran/pull/176), [Santoreno staging #40971275548](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40971275548) SUCCESS. Verified canonical Hafs anchors, primary Sheikh publish, owner readback, 409/idempotent replay and isolation.
- **05B explicit student text submission + teacher review/retry API/D1 ACCEPTED ON DEV**: Noor main [PR #179](https://github.com/geminiamo0-ship-it/nour-elquran/pull/179) `b0b03c2278325cc63de2b38770cc4eb05781ca46`, [Noor main Verify #40974982514](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40974982514) 4/4 PASS, [Santoreno remote #40975149637](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40975149637) validate/deploy PASS with owner submitted note, retry, teacher decision, accepted second attempt, role revoked, 404/409 and immutable history. **API acceptance, not new visual UI QA**; #173 and #178 remain OPEN for targeted student/Sheikh UI visual behavior.
- **Voice R2 is NOT ENABLED**. Existing local optional MediaRecorder stays on device; #180 defines consent/retention/owner identity, private storage upload/playback ACL and cleanup prerequisites. No Production users, real minors, verified guardian/OTP or live audio shipped. Chrome in default Verify and ordinary staging is OFF, manual targeted acceptance only. All earlier "branch only/not deployed" headers below are historical and superseded by this exact evidence.

## Phase 05B #178 — Student submission / Sheikh review (source implementation; NOT YET DEPLOYED)
- Noor 05A publisher `main@bff8c6be7015a0a3fd48254158f5e93b58e23527` accepted on real [Cloudflare Dev #40971275548](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40971275548) with D1 owner readback, teacher auth, 409 replay/conflict. #173 still OPEN for specific student/Sheikh assignments visual acceptance (Chrome on demand).
- Branch `feat/178-assignment-submission-review`: additive D1 migration `0011_assignment_submissions.sql` and append-only submitted attempts (max 5) / teacher decisions. Same verified Better Auth owner vs current qualified primary Sheikh; immutable event history; student explicit text note submit and Sheikh accept or request retry. No fake grades or private Quran leakage.
- **This branch is unverified source, not on Dev or Production** until exact-head GitHub Verify and targeted Santoreno remote D1 acceptance. Child audio / MediaRecorder server upload / R2 / consent remain OFF and belong to Phase 06. No general Chrome added.

## PHASE 05A #173 published assignments (source branch; not yet accepted)
- Additive D1 0010 immutable publish journal, current primary-teacher-only operations, Quran canonical ayah FK, single-learner assignment publish and owner list. Connected teacher Assignments and student My Training read real server state; voice/audio, submission, feedback and cancellation not connected.
- Branch `feat/173-published-assignments-main` is a rebase/reconciliation of the earlier draft onto merged teacher URL fix #169. **No Verify, merge or remote stage proof yet.** Exact-head fast CI, main push Verify, then targeted existing Noor Dev Worker/D1 acceptance required. No Production/real minors.

## #169 Sheikh Dev connected routing — detected/patch pending (2026-10-30)
- Santoreno [run #40968034708](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40968034708) failed ONLY at targeted teacher Chrome acceptance. Failure screenshot artifact #12938892414 revealed connected account was routed to generic non-backend page because exported `/teacher/students/` didn't equal strict `/teacher/students` in `TeacherReadOnlyView`.
- `fix/169-teacher-static-trailing-slash` normalizes the slash for actual teacher routes with pure regression tests. **Branch only, not verified/deployed.** After merge and postmerge Verify, rerun isolated Santoreno teacher Dev acceptance; leave #169/#248 OPEN on failure. Production remains unchanged. Do not run unrelated Chrome suites.

## CI FAST PATH #171 — IMPLEMENTATION BRANCH (2026-10-30)
- Owner requested stopping unneeded heavy repeated Chrome workflows. `chore/171-fast-ci-browser-on-demand` removes two automatic Chrome journeys and second browser-specific Next build from default Verify. Critical lint/TS/unit/HTTP/native D1 migration and Better Auth local authorization tests remain mandatory.
- New explicit workflow `Browser QA (on demand)` allows `static`, `account`, or `all` test scopes and synthetic screenshots. Run it before approving substantial UI changes or a release. Do not claim visual acceptance solely from default Verify.
- **Not yet validated/merged:** exact-head GitHub Verify + policy/YAML, PR merge and postmerge evidence required. No runtime service, Classroom or Cloudflare production change.

## TEACHER VERIFIED / PREVIEW SPLIT — #169 (DRAFT BRANCH ONLY)
- `feat/169-authenticated-teacher-mode` makes connected Sheikh mode contingent on BOTH explicit build feature and verified Better Auth account state: signed-in -> existing teacher-only D1 adapter (403/404 for invalid roles), signed-out -> clearly labeled public fixture preview, checking/error -> no fake learner data. Default build flag remains OFF.
- Pure state tests cover no authenticated fallback to previews; no teacher self-enrollment, staff grant or classroom access. This does NOT yet turn on connected mode in existing Staging; source PR CI and dedicated Chrome Dev synthetic teacher rollout must pass before closing #169.
- #167 rich Students roster/details code is merged; direct per-learner plans read/write remains scoped to qualified active primary teacher D1. Avoid real guardian/student data.

## TEACHER CONNECTED STUDENTS #167 — BRANCH ONLY (not deployed)
- Issue #167 `feat/167-connected-teacher-students-layout`: replaces generic connected cards at `/teacher/students` with existing professional Teacher roster/detail layout, actual authorized D1 roster and lesson list, plus server-confirmed per-learner academic plan editor. No fixture scores/reports/assignments are injected into connected mode. Browser/role flag remains opt-in and OFF on ordinary staging build.
- A derived roster guard prevents expired/revoked selection from exposing stale learner detail or another learner's lessons. Unit tests assert scope after roster changes.
- **Not yet Verified/Merged/Deployed.** Next exact-head CI and native synthetic Chrome in connected teacher mode, then explicitly scoped Dev feature-flag staging; public teacher preview must not be lost, auth still resolved server-side. No Production, payments, WhatsApp or Classroom changes.

## STUDENT ACCOUNT MOBILE UX #160 (DRAFT, NOT DEPLOYED)
- Branch `fix/160-account-mobile-header-ux` addresses connected profile selector truncation shown in Santoreno remote staging artifact #12934533154.
- Mobile <=650px: learner selector gets real available row width, full current learner text is discoverable, session/logout controls get their own compact row; menu is anchored below the dynamic header instead of fixed pixel top. Account list edit/archive actions grouped so they wrap consistently at 1440 as well.
- Native Chrome checks include 360/390/768/1280/1440 account screenshots, selector min width and positioned menu; exact-head Verify and actual remote staging visual comparison are **still pending**. No D1/roles/messaging or Classroom changes.

## NON-CLASSROOM PHASE 02A #162 — ACADEMIC PLAN DRAFT (2026-10-29)
- [Issue #162](https://github.com/geminiamo0-ship-it/nour-elquran/issues/162) implements a first teacher-owned learner plan slice with additive D1 0009, immutable audit+CAS and owner/assigned teacher routes. The connected teacher `/teacher/students` read adapter now has a per-student plan form; connected student `/student` reads its own plan without falling back to mock academic scores.
- **Branch only. No proof of passing CI, Staging migration, teacher account provisioning or remote UI yet.** Production, Classroom and related billing/message providers unaffected. Building one plan does not publish any homework.
- Next: exact-head Verify, native Better Auth Worker role/owner plan tests, then separately gated existing Noor-only Staging via Santoreno; activate read-only teacher build flag only with synthetic qualified teacher staging account and proved permissions. Keep #162 open until remote acceptance.

## NON-CLASSROOM PHASE 01A #157 — CLOUDFLARE DEV ACCEPTANCE PASS (2026-10-29)
- [PR #158](https://github.com/geminiamo0-ship-it/nour-elquran/pull/158) was squash-merged as `68b218cf99ff436acf34292d39692a8011862c6a`, after exact-head [Verify 40957686804](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40957686804) 4/4. Postmerge [Noor main Verify 40958071853](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40958071853) passed.
- [Santoreno PR #243](https://github.com/geminiamo0-ship-it/santoreno/pull/243) merged as `a0b28bc4af7e95de983c37ff696174ffb9a9797a`. [Remote Cloudflare staging run 40958341460](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40958341460) **SUCCESS**: only `noor-site-staging` + isolated D1 `noor-core-staging`; actual deployed API and Chrome with synthetic owner A/B/siblings.
- Remote proven: session and per-owner 404, revisioned rename, CAS 409, replay, archive/removal from active list, retained Quran ink/notes/bookmarks plus immutable before/after audit, five responsive Chrome screenshots (360/390/768/1280/1440, no horizontal overflow). Artifact `noor-profile-remote-browser` ID `12934533154`. Verified Quran canonical 6236 anchors were already present and unchanged; public registration remains developer-only synthetic.
- Scoped Phase 01A account lifecycle is accepted **only on developer staging**; master #155 stays OPEN. Guardian phone proof, password recovery, policies/consent, real-user/production activation, teacher portal binding and payment/notifications remain unimplemented.
- Visual review found cramped 360px profile selector and desktop row wrapping; separate [UX #160](https://github.com/geminiamo0-ship-it/nour-elquran/issues/160). Next non-classroom connected Sheikh stage [#159](https://github.com/geminiamo0-ship-it/nour-elquran/issues/159). Pending Quran offline zero-loss and multi-device stylus remain under #142/#149.
- Rollback: revert only the staged Worker/UI if needed. **Never drop D1 `0008_learner_profiles` or history/audit data.** No Santo, separate QA Worker, Classroom runtime or production mutation.

## PRIVATE QURAN #149 — fail-closed current-page hydration (draft PR; 2026-10-29)

- Connected Quran writing is now permitted only after **both** owner-scoped index and the **same learner + current page** have hydrated; stale previous-page or previous-learner results cannot unlock ink on a new page. A failed save locks further connected edits until Retry. Demo-only local drawing remains unchanged.
- Added a pure readiness guard with Vitest regressions for page/learner mismatch, failed save and demo mode; reader's ink overlay and callback use the page-specific guard, and the connected note empty-state no longer says "this session".
- Source branch only: exact-head GitHub Verify, connected synthetic Chrome/D1 QA, real canonical metadata and independent privacy review remain separate gates. **No production deploy, real student data, or cloud migration.** Next: inspect exact PR head CI; stage only in isolated password-protected Quran QA and exercise page-turn-during-load, failed-write retry, reload and second-account denial before enabling real learners.

## PRIVATE QURAN #144 — hidden annotation reload correction (2026-10-29; PR #146)

- Found and corrected a real persistence regression: after hiding a stable-ID bookmark/note/highlight, the old visible-only GET omitted its version; reopening the reader then attempted a new version-0 PUT and D1 correctly rejected it. GET now returns hidden stable-ID tombstone/version metadata to the authenticated owner; UI filters hidden content from rendering, preserving correct versioned restoration. Erased freehand strokes remain excluded from page hydration to avoid wasting the 300-record page cap.
- Updated Worker TS regression and contract. No D1 schema change, remote migration, staging or production deployment. **Exact-head CI for this follow-up must be inspected before merge.** Current per-component in-memory pending queue remains vulnerable to browser crash before ACK; offline zero-loss and pagination remain unfulfilled gates.
- Next: verify exact-head Verify for PR #146, review client pending/error/undo behavior, test synthetic refresh and native Cloudflare auth, then stage only with separately verified canonical Quran edition+anchors and approval.

## PRIVATE QURAN P0-1 #144 (code PR #145; gated, no remote rollout)

- Added private D1 append-only Quran operations + versioned projection in `0007_private_mushaf.sql` and owner-verified GET/POST reader API. Supports pen, marker, ayah highlight, note, bookmark, reading position, hide/restore undo/redo with atomic CAS and idempotency.
- `NEXT_PUBLIC_QURAN_PERSISTENCE_ENABLED` AND `NEXT_PUBLIC_ACCOUNT_UI` are required for real student reader; OFF by default, old demo preserved. UI shows pending/saved/failure; no claims of offline zero-loss. Native synthetic Worker/SQLite suite and mandatory remote staging follow-ups.
- **Hard external gate**: Canonical R2 Quran edition `hafs-kfqc:v1.1.1` verified manifest and ayah anchors MUST be imported independently to staging D1; this PR adds no fake production metadata, deploy/secret/real learner. Read [full contract](docs/PRIVATE_QURAN_PERSISTENCE_CONTRACT.md) and #144/#142 for limitations and acceptance.

## MASTER PERSISTENCE / RECOVERY PLAN — #142 (documentation only, 2026-10-29)

- [Complete inventory / implementation blueprint](docs/PERSISTENCE_AND_LESSON_RECOVERY_MASTER_PLAN.md) records how pen, marker, erase/undo, private notes, shared lessons, teacher reports, assignments/audio, study progress, access, archives and backups must **actually** save and restore. [Issue #142](https://github.com/geminiamo0-ship-it/nour-elquran/issues/142) is the parent delivery tracker.
- **No persistence service was implemented in this plan PR**. Student reader ink/notes and teacher classroom/report preview remain session-local; D1 `personal_annotations` table alone does not imply API. B1–B3 verified teacher CRUD read/role/assignment/booking source only. Do not infer remote staging or production migration.
- Priority: isolated stage of existing B1–B3, then verified private Quran annotation save/reload + tombstone/undo, then LessonDO shared seq/ACK/replay, then immutable archive + draft/published report, then notebook and homework audio. Verify role/learner/sibling privacy and D1/DO/R2 restore before live minors.

## TEACHER BACKEND B3 #140 — audited staff assignments & 40m booking

- `0006_staff_schedule.sql`: append-only staff scheduling commands and atomic D1 audit triggers for `assign,revoke,book,cancel`. Rechecks roles.manage, active qualified teacher, active owner/learner, full-interval primary assignment, overlap/40m, 6h normal cancellation, and no orphaned upcoming lessons. No room Start/End mutations.
- `src/staff-scheduling.ts` and `auth/routes.ts`: POST `/v1/staff/schedule-actions` behind real Better Auth staff session and current grant, exact allowlisted action DTO and idempotency UUID. Existing teacher roster/timetable and owned learner timetable now have a real staff-only writer.
- SQLite exact-migration tests and native Wrangler local synthetic staff/teacher/account browser/auth smoke. Real staff/teacher provisioning, OTP verification, remote Staging migration/deployment and real student data still intentionally absent. Default preview unchanged; authenticated teacher read UI feature flag OFF.
- Next: verify exact-head CI and only then merge; isolated remote synthetic staging role/assignment/booking UI proof, and follow-up teacher learner plans, last published report and class preparation.

## TEACHER BACKEND B2 #138 — staff-only role provisioning (PR #139)

- D1 migration `0005_teacher_roles.sql`: audited append-only role command ledger with atomic status/qualification transitions using SQLite triggers, actor grant/phone/active account guard and replay constraint. Existing teacher data unchanged.
- New staff-only `POST /v1/staff/teacher-actions`: Better Auth session + unrevoked `roles.manage`, strict JSON, UUID idempotency, server-sourced actor/time. State flow: provision dormant/unqualified → qualify → activate → suspend or revoke qualification. Staff self-promotion forbidden.
- Native Wrangler local synthetic admin/teacher verification added to `scripts/cloudflare-auth-smoke.mjs`. Strict no real OTP/credentials/teacher grants: bootstrap role/phone flags ONLY in disposable synthetic local D1. No cloud staging/production migration, users, real teacher role or frontend activation.
- B3 remains: staff assignment + booking, synthetic staging and real teacher account eligibility, then learner plans/preparation and report/assignments. All CI gates and PR verification required before merge.

## TEACHER BACKEND #136 — initial secured read-only implementation (Draft PR #137)

- Added D1 primary-roster read boundary + protected `GET /v1/teacher/learners`, verified Better Auth qualified teacher only; substitute grants never confer roster access. Exact SQLite migration and Node tests cover future/revoked/expired assignments, archived child, disabled household and query scoping.
- Connected only an opt-in **read-only** Sheikh home/roster/schedule UI using verified API responses and strict client DTO validation. `NEXT_PUBLIC_TEACHER_READONLY_ENABLED=true` AND `NEXT_PUBLIC_ACCOUNT_UI=true` required at build; disabled by default to preserve staging visual demo. No mock fallback in authorized mode; report/homework/plan pages explicitly unconnected.
- NOT done: actual Sheikh account provisioning, lesson brief or academic profile API, report publication, real class/LiveKit, live D1 migration or real child records. Do not deploy production or enable real accounts; exact-head Verify and review required.
- Next: inspect CI, stage with SYNTHETIC D1-qualified teachers after controlled provisioning; implement academic plan/report contracts and subsequent LessonDO handshake in focused follow-ups. See #45/#120.

## CLASSROOM #120 / PR #121 — persisted Start/End sequence guard (2026-10-29; draft)
- In additive D1 migration `0003_teacher_schedule.sql`, reject new `live`/`completed` rows, `scheduled -> completed`, and `cancelled -> live/completed`. A canceled reservation must re-enter `scheduled` (rechecking teacher/learner eligibility and conflicts) before Start; completion follows a Start. Existing historical rows are not rewritten.
- Synthetic SQLite regressions cover direct insertion bypass, canceled shortcut, scheduled direct completion and atomic unchanged status. Updated historical test fixtures to follow `scheduled -> live -> completed` after migration. These are relational state guards, **not verified teacher identity, two-party presence, request-id idempotency or authoritative End timestamps**.
- Exact-head CI pending on this commit; do not merge Draft PR #121 until checks/review. No remote D1 migration, production deployment, paid service, private media or real learner data. Next: authenticated teacher-only lifecycle with durable verified lobby presence and idempotency.

## CLASSROOM #120 / PR #121 — terminal lesson-state integrity (2026-10-29, draft branch)
- Added `lessons_terminal_lifecycle_guard` to draft D1 migration `0003_teacher_schedule.sql`: a `live` lesson cannot be rolled back to `scheduled` or `cancelled`, and a `completed` lesson cannot be resurrected. Same-status writes and pre-start cancellation/reactivation remain allowed. This prevents a direct status rollback from evading the existing single-live teacher/learner guard.
- Three synthetic SQLite tests cover atomic rollback denial, completed-history terminality, allowed no-op transitions and explicit completion before the next room starts. This is NOT actor authorization, presence, or durable request-id idempotency. Exact-head GitHub Verify is pending; PR remains Draft.
- No remote D1 migration, production deployment, paid services or real learner data. Next: inspect exact-head CI; build authenticated teacher-only Start/End with simultaneous verified teacher+learner presence and request idempotency as a separate reviewed slice.

## CLASSROOM #120 / PR #121 — concurrent-live D1 guard (2026-10-29, draft branch)
- On `feat/noor-classroom-40m-booking-guard`, migration `0003_teacher_schedule.sql` adds SQLite/D1 INSERT and UPDATE guards preventing a teacher or learner from belonging to two simultaneously `live` lessons, even if the bookings are adjacent and the first room overruns its 40-minute slot. No timer automatically ends a room.
- Four new synthetic SQLite regressions cover teacher overrun, same-learner different-teacher overrun, independent concurrent rooms and direct-live-insert bypass; failed transitions must leave the second booking scheduled. Changes are unmerged and CI on the final exact head must be checked.
- This is a database integrity backstop, **not** authenticated teacher-only Start/End, both-party presence, idempotent state transitions or media integration. No remote D1 migration, production deploy, real learner data or paid provider use. Next: inspect exact-head CI, then build the authenticated/presence-verified lifecycle under #120 after review.

## CLASSROOM #120 / PR #121 — historical teacher integrity (2026-10-29, draft only)
- CI exposed an incorrect assumption in an initial test: `0001_core.sql` already makes `lessons.learner_id` immutable, so reassignment is prohibited even for active learners. Corrected the test and removed the redundant proposed eligibility trigger change.
- Added `lessons_teacher_immutable_after_start` to draft `0003_teacher_schedule.sql`: the acting teacher may change while scheduled, but cannot be silently rewritten when the lesson is live or completed. Two SQLite regressions cover immutable learner identity and teacher identity across scheduled/live/completed.
- These are database integrity rules, **not** role authorization, presence verification, Start/End APIs or live-room lifecycle enforcement. No remote D1 migration, staging/production deployment, or real learner data. New exact-head CI pending; PR remains Draft.
- Next: check CI; review teacher/substitute lifecycle with #120 before merge, then implement authenticated teacher-only Start/End with verified simultaneous presence and idempotency.

## CLASSROOM #120 / PR #121 — booking eligibility continuation (branch only, 2026-10-29)
- Additive draft D1 migration `0003_teacher_schedule.sql` now rejects new/reactivated scheduled bookings when learner is archived or owning account disabled, and rechecks learner, owner and teacher eligibility on schedule changes. Existing completed history remains intact. Four synthetic SQLite regression cases added to `test_teacher_calendar.py`.
- This is a database integrity guard, **not** authenticated booking/start/end or verified waiting-room presence. No remote D1 migration, deployment, child data or payment action. Exact-head GitHub Verify must be inspected before treating the branch as tested; PR #121 remains draft.
- Next: verify PR #121 exact-head CI and human review; then design separate authenticated teacher-only Start/End with two-party presence and idempotency in #120, without inferring presence from lesson status.

# PROJECT_STATUS — verified handoff state

## OPEN DEV STAGING #118 — implementation branch (not yet deployed)
- Owner requested open, passwordless preview of the existing `noor-site-staging` site. Site Worker offers `NOOR_DEV_OPEN=true` specifically for the developer staging Worker: no extra Basic password for pages or API. Normal Better Auth password/session and owner-level learner authorization remain enforced.
- Companion Santoreno provisioning workflow must build `NEXT_PUBLIC_ACCOUNT_UI=true` (account-enabled developer UI), configure open-dev flag and verify real Cloudflare 200 pages/assets, app-level anonymous 401, synthetic registration/session/ownership smoke. **No remote public rollout verified yet.**
- Existing account data and D1 stay private. Public phone registration is prohibited until provider verification/guardian authorization; OTP remains deferred. See [runbook](docs/NOOR_STAGING_RUNBOOK.md). Track #118; follow-up #46/#56 remain.

## STAGING #114 — VERIFIED remote Cloudflare staging, 2026-10-29
- Frontend account UI #112 merged as [PR #113](https://github.com/geminiamo0-ship-it/nour-elquran/pull/113), main `64eaaa2`, postmerge Verify [40807730642](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40807730642) SUCCESS. Stage-only access guard [PR #115](https://github.com/geminiamo0-ship-it/nour-elquran/pull/115) merged as `dff83b382b3774a7476ae8dee64b7454fd09859c`; postmerge Verify [40808432004](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40808432004) SUCCESS (all four).
- Cloudflare-only remote staging **DEPLOYED and VERIFIED**, using isolated D1 `noor-core-staging` plus Worker `noor-site-staging`, same-origin static Next assets/API, `assets.run_worker_first=true`, server-only Basic access gate, and account/auth secrets. No production Worker/D1 or Santo product resource was changed.
- Verified remote synthetic end-to-end in Santoreno [Noor Staging run 40810303172](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40810303172) **SUCCESS**; companion [Verify 40810302568](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40810302568) SUCCESS; deployed Noor source `dff83b382b3774a7476ae8dee64b7454fd09859c`. Checks unauthenticated assets/API denied 401, gated /health and /ready 200, synthetic registration and `phoneVerified=false`, HttpOnly/SameSite cookie and session restore, two learner profiles, cross-account 404 and logout replay denial.
- This is **staging only with synthetic test accounts**. Email/SMS/WhatsApp OTP deliberately deferred, phone ownership unverified. Human staging access still requires rotating the random private gate credential to an authorized known password/Cloudflare Access. Remote real-browser visual QA, restricted child/staff flows, provider-backed recovery, billing, teacher assignments, private data APIs and cloud D1 restore rehearsal remain separate work under #46, #56 and notebook #102. No real students or messages. See [runbook](docs/NOOR_STAGING_RUNBOOK.md).


## Historical AUTH-02 #112 — same-origin account UI (previous branch checkpoint; merged as PR #113)
- Baseline main #111 `14e73efde6e406dff34603ef053b2f17e789984c` passed all four jobs in [postmerge Verify 40803047786](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40803047786). #110 closed; #43/#46 remain open.
- `feat/112-account-ui` adds a typed/runtime-validated same-origin client, opt-in signup/login/logout/session and owner-profile UI. Connected learner data never uses demo fixtures; raw session tokens/passwords/contact are never persisted by application browser storage. Interrupted registration can recover the existing account/profile.
- Public `NEXT_PUBLIC_ACCOUNT_UI=true` is a build-time UI switch only, OFF by default; server AUTH_ENABLED/D1/secret/origin remain independent requirements. Root Worker composes API paths with static assets so cookies stay same-origin and existing branded asset/404 behavior is retained. No remote D1 binding or authentication secret is checked in.
- New native local Chrome gate builds opt-in UI and uses isolated Worker+D1. Covers response loss after profile insertion, reload/session restore, siblings, HttpOnly cookie, logout replay, cross-account separation, wrong password and expiry; 360/390/1440 screenshots. CI outcome is pending, not inferred from existing backend tests.
- No remote provisioning/deploy, verified phone/recovery, booking/paid/teacher/child login or real-user rollout. Next: pass exact-head CI and review/merge; #46 retains verification/recovery, role policies, staging and operational acceptance.

## AUTH-01 #110 / PR #111 — 2026-10-29, native implementation verified before final handoff
- Main includes #109, merge `a8ea58cdc76c25ad89ff02bb1e280bd3b90559e4`; its postmerge [Verify 40800758113](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40800758113) passed. #46 remains open.
- AUTH-01 implements pinned Better Auth 1.7.14 + Drizzle 0.45.2 on Workers/D1: phone/password registration/login, signed HttpOnly session, D1 revalidation/logout revocation, and owner-scoped learner create/list/read using the existing owner-read SQL boundary. Default OFF until explicitly configured. Phone ownership remains unverified; no OTP/recovery/messages enabled. See [ADR 0005](docs/adr/0005-d1-phone-password-auth.md).
- **Verified code head `e1fd72e68a786d7c41497d124b3c91cc332fce5b`: [Verify 40802629650](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40802629650), all four jobs SUCCESS.** Includes 26 Node + 22 SQLite backend tests, existing frontend/build/Chrome regression, native local migration replay and real Better Auth signup/login, cross-account denial, profile cap, origin/body restrictions, persistent credential throttling, logout replay, account disable and expiry. First run 40802500608 passed native but failed two unused smoke declarations; corrected before the green run.
- Final handoff/docs and explicit session-response assertions follow that code head; inspect their exact-head CI in #110/PR #111 before merge. Native evidence is local, not cloud staging.
- No cloud resources, remote migrations, real users or frontend auth integration. Next exact action after #111: connect existing signup/profile UI via a separate issue; #46 also retains phone verification/recovery, restricted child/staff flows, isolated staging and operational acceptance.

## Active #46 native local runtime gate — 2026-10-29 (unmerged)
- Baseline main `dc3da3e041c57e9e6af8734fc2bb323885f9be60` is the merged CF-01 #108; [main Verify 40792047893](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40792047893) passed. #104 is CLOSED; #46 and #102 remain OPEN.
- Branch `test/46-native-local-d1-worker-gate` adds a disposable **Wrangler local** D1 migration replay + Worker HTTP gate to Verify. It checks the actual Worker D1 binding reports `database: ready` while all protected routes stay closed even with forged headers. Uses pinned Wrangler 4.45.0; no cloud account, remote D1, deployment, user data or new runtime dependencies.
- **Verified native local CI:** PR #109 code head `c098fad5476ee276e17887e3a32c8cdca4f52fb9` passed [Verify 40795971889](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40795971889): all four jobs SUCCESS, including `cloudflare-local-d1` (Wrangler executed 26 local migration SQL commands; second apply reported no pending migrations; Worker `/ready` found schema and stayed auth-closed). This proves native **local** Worker/D1 behavior only, not cloud staging. Subsequent documentation-only commits need their own exact-head CI. Next: fix any native runtime/SQL failures; then #46 maintained auth library + verified sessions and isolated Cloudflare staging after appropriate provisioning authorization. #102 frontend notebook can proceed independently.


Current integration baseline: main `df284bcf00e81b6199067d6d9386eb2e10a35997` (merged #105 static Next.js export/Workers assets fix). CF-01 preserves those files. Draft #107 overlaps the foundation and is consolidated in #108 with one migration lineage and the revised #103 plan.

## Current checkpoint — Cloudflare adoption, 2026-10-29 Cairo (#104)
Owner approved Cloudflare-only infrastructure. [ADR 0004](docs/adr/0004-cloudflare-only-platform.md) supersedes Supabase Auth/PostgreSQL/RLS and the previous LiveKit provider choice. RealtimeKit and Workers/vinext are targets requiring their own verified integration; no frontend or media cutover occurred here.

CF-01 branch adds a real Worker handler with health/schema checks and fail-closed learner routes, pure server-input authorization helpers, strict D1 migration for account/learner/teacher/lesson/private annotations, and Node/SQLite regression tests. Protected routes remain 503 AUTH_NOT_CONFIGURED. No real auth, remote D1, production SQL, private upload, backup job, A/V, payment or messaging is implemented/provisioned.

Local targeted checks: 18 Node tests and 19 Python SQLite tests pass, including ownership constraints and SQL export/restore roundtrip. Full exact-head GitHub Verify must be linked in #104/PR; local tests are not native Cloudflare evidence. [Runbook](docs/CLOUDFLARE_BACKUP_AND_RESTORE.md) specifies Time Travel and longer export/recovery scope, with no remote restore performed.

Next exact backend action: #46 integrate maintained auth on Workers/D1, actual isolated staging config and native D1/session/authorization verification. #102 notebook frontend remains open and must use real contracts without claiming this foundation saves student data. PR #103's plan is included and revised by this continuation; old plan/backend descriptions below are historical.

## Earlier planning checkpoints


## Current checkpoint — 2026-10-29 Cairo, planning issue #101
- Inspected main at `906a993d0ea350591692045fa878da34995d7c1c`; Training PR [#100](https://github.com/geminiamo0-ship-it/nour-elquran/pull/100) is merged. Native Next.js student frontend and Quran reader exist with explicitly temporary/demo learner state. This supersedes older foundation-only status descriptions below.
- Owner requested a complete notebook/backend-readiness plan. [Detailed Arabic plan](docs/LESSON_NOTEBOOK_AND_BACKEND_READINESS_PLAN.md) covers notebook UX, schema/API, roles/RLS, immutable publication, Mushaf projection, private media, recovery, operational dependencies, phased delivery and future acceptance tests.
- This documentation branch `docs/101-notebook-backend-readiness` implements no notebook renderer, backend, migrations, private upload, LiveKit, payment or WhatsApp. No deployment/provisioning or messages.
- Next frontend task: [#102](https://github.com/geminiamo0-ship-it/nour-elquran/issues/102), filtered Notebook viewer/contracts on the existing renderer. Next backend start: B0/B1 under [#46](https://github.com/geminiamo0-ship-it/nour-elquran/issues/46), identity/account/learner ownership and RLS before real records.
- Exact-head CI must be inspected and linked in #101; no test result is inferred from a prior PR. One backend integration milestone is delivered through ordered PRs.

## Historical checkpoints — retained for provenance; read current checkpoint first

Last inspected: 2026-10-28. **Distinguish main from unmerged PR branches.**

## Merged into main (governance, not a deployed application)
- Governance PR [#2](https://github.com/geminiamo0-ship-it/nour-elquran/pull/2) merged as `24f57aa8c9024eb1cbd246a57ae5dff758a07e28`.
- [Post-merge Verify run 40611612261](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40611612261) succeeded for governance checks. The main branch does **not** yet contain the Next.js workspace.
- [Issue #1](https://github.com/geminiamo0-ship-it/nour-elquran/issues/1) remains OPEN: enforce and verify a main ruleset with PR review, required status checks and no direct/force pushes.
- The owner explicitly decided to keep the repository **PUBLIC**. No request to make it private is pending.

## Active unmerged work — CORE-01 #39
- [Draft PR #60](https://github.com/geminiamo0-ship-it/nour-elquran/pull/60) from `feat/39-bootstrap-workspace` to `main`.
- Real branch-only workspace: pinned pnpm 10.22.0 lockfile, Next.js 16.4.3 / React 19, strict TypeScript, Arabic RTL foundation-only route, feature-first components, CSS modules, architecture boundaries and cycle tests, HTTP smoke.
- **Verified previous head** `392bff47f9449c1009d271ddbea188f235cdc255`: [Verify run 40680982177](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40680982177) **success**, including repository-policy, governance-tests and code-quality (frozen install, lint, typecheck, unit tests, Next build, HTTP smoke).
- **New changes after that successful run** add `scripts/browser-smoke.mjs`, `browser:smoke` script and GitHub Actions Chrome screenshot gate for 360px, 390px and 1440px. This new browser code **passed** on exact head `1f312a54a39f13210c054313a20e25fe38124791`: [Verify run 40694813876](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40694813876) **success** (all three jobs, including Chrome smoke and screenshot artifact upload). Subsequent documentation-only commits must be verified separately.
- The GitHub Actions screenshot artifact `noor-bootstrap-browser-screenshots` (artifact ID `12818582438`) was downloaded and visually inspected: 360×900, 390×900, 1440×900, with legible RTL text and no obvious clipping. This is a foundation-screen review, **not** final landing aesthetic or full accessibility sign-off. Automated checks cover real Chrome rendering, Arabic `lang`/`dir`, expected demo disclosure, viewport width and no horizontal overflow; screenshots alone do not prove aesthetic approval.
- No migrations, real auth, learner records, Supabase, LiveKit, payment integration, Cloudflare staging or production deployment.

## Related pending work
- [PR #58](https://github.com/geminiamo0-ship-it/nour-elquran/pull/58) is a separate draft architecture guardrail change under #57; review its overlap with the AST-based checks in #60 before deciding whether to merge.
- [Issue #40](https://github.com/geminiamo0-ship-it/nour-elquran/issues/40) Next.js/vinext Cloudflare compatibility spike remains separate and unverified; do not select a different framework without measured evidence.
- Landing V3 [#9](https://github.com/geminiamo0-ship-it/nour-elquran/issues/9), classroom [#7](https://github.com/geminiamo0-ship-it/nour-elquran/issues/7) and [roadmap #38](https://github.com/geminiamo0-ship-it/nour-elquran/issues/38) are approved specifications, not evidence of built pages.

## Next exact steps
1. Verify the newest PR #60 head SHA and CI after documentation commits; prior browser evidence is at `1f312a54` / run 40694813876. Keep screenshots for reviewer sign-off.
2. Review #60 against #57 and reconcile any overlap with #58. Leave draft/open until acceptance and required human review.
3. Owner/admin must enforce the [main ruleset](docs/CI_BRANCH_PROTECTION.md), including `repository-policy`, `governance-tests`, `code-quality`; verify actual settings in #1.
4. After review and successful gates, merge only with required authorization; then verify main CI. No production deployment.

## Status report template
Date / Issue / PR / exact head SHA; changed paths; tests and exact Actions URL; browser/staging/production evidence; migrations/deployments (or none); risks; next action.

## 2026-10-28 — route API boundary hardening (unmerged)
- Previously verified PR #60 head `3dbe0cf562248331cfee89298dce6a36b6d5a3cb`: [Verify 40695487092](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40695487092) **success**, including Chrome responsive smoke.
- Follow-up on #39/#57: `scripts/check-architecture.mjs` now rejects **route entrypoints importing private feature modules**, for alias and resolved relative paths; `tests/architecture.test.mjs` adds negative static, relative and lazy-import fixtures plus an allowed public-index fixture.
- The new code was committed on `feat/39-bootstrap-workspace` after the above green run. **Verified code-and-handoff head `51fbde724dac1f9a424f210d953986d47e2f983e`: [Verify 40698369854](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40698369854) completed SUCCESS** (repository-policy, governance-tests, code-quality; frozen install, lint with architecture gate, unit tests, strict typecheck, Next build, HTTP and Chrome responsive smoke). Any later documentation-only commit requires its own CI confirmation. No migration or deployment.
- Next: inspect latest PR #60 head and all three Verify jobs, document result in #39 and PR; reconcile #58 overlap, obtain human review and enforce #1 main ruleset before merge.


## 2026-10-28 — native React V3 conversion (branch, pending CI)
- Branch `feat/landing-v3-native-react-interactions` originates at merged PR #64 `fd7b2b6c428d`.
- Replaces injected V3 HTML fragments with JSX in all 14 section components. Classroom tool state, canvas drawing, notes, form/profile flow, mock slots and modal state now use React components/hooks; no standalone runtime interactions script in the route.
- Preserves approved CSS and Arabic RTL visual design. Adds reduced-motion handling and source integrity tests. Demo remains entirely browser-local, not authenticated or booked in a backend.
- Verify code-quality, TypeScript/Next build and 360/390/1440 browser screenshots on this PR's exact head before merge. Further acceptance needed for real auth and accessibility.

## 2026-10-28 — CORE-06 #44, M2 learner portal (branch/CI pending)
- Branch: feat/44-student-portal-m2, based on merged React landing #66 (main 1212d865). Full /student prototype with Home, Lessons, Mushaf, Training, Progress/Reports, Notebook, Subscription and Account routes.
- Learner profile switch in shared header; newcomer gets complete dashboard with empty states, not fictitious instructor/grades; demo-active and trial-booked profiles are explicitly labeled as invented fixtures.
- Dashboard primary panels equal width for 7-day Cairo-local schedule and teacher-approved daily Wird. Three teacher grades (/10) remain independent and null ≠ 0; draft assignments and cross-learner reports are filtered at the data adapter.
- Landing mock registers only in-memory/session demo learner names for the same-tab navigation; NO phone/email, persistent database, real auth/booking/payment/LiveKit, or server records.
- Verification: typecheck, unit, build, HTTP and real Chrome 360/390/1440 screenshots and sibling switching tests required from exact PR head before merge. No production deployment claimed.
- Next: #45 teacher portal mocked UI; #40 Cloudflare runtime spike; #46 Supabase Auth/RLS for real family access after design/security decisions. Issue #43 remains open for real registration.

## 2026-10-28 — CORE-06 #44 continued: student workspaces (branch, CI pending)
- Branch `feat/44-student-portal-workflows` based on merged PR #69 (`105635e`).
- Replaces student route placeholders with independently componentized lesson history/detail filters, pre-submission task drafts, separated academic criteria and report details, lesson notebook and per-learner personal draft notes, Quran fixture highlight/notes/clear, subscription status, and session-only add/remove student profiles.
- The Quran fixture uses the already approved V3 sample, explicitly not an authoritative Quran edition; full licensed canonical text/audio and realtime media are not supplied. No actual homework is submitted, no session joined, no real student records/billing/authorization or media saved.
- Learner-local study notes/assignment drafts are in-memory and explicitly not teacher-approved grades or published reports. Switching sibling profiles keys page-local forms, while the shared provider partitions all local state by learner ID. Phone/email are not recorded to session storage.
- Needs exact-head CI lint/strict TS/unit/Next build/Chrome 360/390/1440 + all 7 routed pages + Mushaf interaction checks; screenshots and accessibility manual review; keep Issue #44 open for integration and final acceptance. M3 auth/RLS remains required before any real data.

## 2026-10-28 — STU-AZ S01 report history correction (PR pending)
- Owner requested complete student frontend A–Z and sequential PRs; see `docs/STUDENT_PORTAL_A_TO_Z.md`.
- Branch: `feat/44-student-az-reports-s01` under #44. Updates `ProgressWorkspace` from unapproved filters/cards to RTL semantic academic table. Adds newest published-per-lesson normalization, page size 5, inline accessible details and honest missing archive.
- Tests: helper and SSR plus appended real Chrome interaction smoke; **CI not yet verified at this point**. No backend, payment, real Quran or deployment changes.
- Next: complete exact-head CI; if passing merge S01, then S02 attendance and 7-day self-service appeals.

## 2026-10-28 — STU-AZ S02 attendance + seven-day appeal preview (PR pending)
- Branch `feat/73-student-attendance-appeals-s02`, Issue #73; builds on merged S01 PR #72 (`6ff52349`).
- `attendance.ts` models teacher-recorded outcomes (present, absent, cancelled, rescheduled, pending), deduplicated latest per lesson, seven-day server timestamp policy, allowed local evidence types/sizes and invented demo sample records.
- `AttendanceWorkspace` is within Student Progress below academic report table: separate four-category counts and detailed RTL register, opened eligible appeal with required written reason and optional file *selection only*.
- There is NO transport/API submission; preview says explicitly not sent, disabled send; expiry shows contact-admin exception text. Never infer a no-show from video attendance.
- Validation requires #73 exact-head CI/Chrome/fixtures. UI review and authorized backend audit pending.

## 2026-10-28 — STU-AZ S03 trial and recurring lesson preference preview (PR pending)
- Branch `feat/75-student-trial-scheduling-s03`, Issue #75. Dashboard CTA now leads to trial booking section inside student Lessons. Does not promise any confirmed slots.
- S03 UI shows 0 EGP, 30-min once/learner demo trial rules, time-of-week/day preference and explicit review step with automatic Sheikh assignment pending server verification. Mock cannot send/confirm booking. Existing trial state clearly marked example; paid weekly selection is preference only, cannot charge or reserve.
- `booking.ts` typed eligibility and six-hour confirmed-lesson reschedule policy; unit+Chrome checks. No booking/teacher assignment/renewal ledger backend created. Review exact-head CI before merge.

## STU-AZ S04 — Real 604-page Quran reader (2026-10-28; branch/CI pending)
- Replaced 4-ayah classroom fixture with a modular `MadinahReader` in `/student/mushaf`: 604-page page-number navigation, safe `img` SVG display, independently fetched verified sidecar references, `آية بآية` from Uthmani source verses, per-learner temporary typed note preview, direct source fallback. No Arabic Quran text was generated or altered.
- Source: Quran.ws version-locked Hafs-KFGQPC SVG v1.1.1 (publisher KFGQPC artwork) and Quran JSON Uthmani Hafs chapters. Frontend prefers dedicated R2 Worker `noor-quran-assets`, falling back to named versioned public sources until upload/Worker is operational. Source attribution and publisher usage rights retained.
- `santoreno` PR #216 (Issue #215) provisions **new isolated bucket** `noor-quran-hafs-v1` and read-only `noor-quran-assets` Worker via its existing Cloudflare Actions secrets; **merge and remote workflow validation pending**. Do not claim bucket exists, that 604 assets were uploaded, or production is deployed until verified.
- No canonical word-level interaction, persistent per-learner annotations, styled mini-player, signed media, or classroom recordings: these belong to S05–S09. Screenshot/production and exact-head CI still required.

## 2026-10-28 — Quran reader experience (#85)
- One batch feature branch for smooth fixed-aspect SVG page rendering, decode-before-swap with last page retained, bounded 10-neighbor preloading (3 concurrent), responsive immersive mobile and bottom paging controls.
- Verse/word source-text selection, private notes list with direct page/ayah jumps, highlighter, S Pen/mouse strokes, marker, eraser, undo/redo, global Hafs search validated against 6,236 ayah page markers. Never modifies canonical Quran text.
- Vercel preview deployments DISABLED temporarily on 3 Noor linked projects to conserve build quota. PR must pass exact-head GitHub Verify before one merge. Production deploy separate.
- All ink/notes are DEMO local memory only; real teacher approved notes and classroom sync, durable private storage and audio/tafsir service require backend/auth/rights. Do not claim those as live.

## 2026-10-28 — Quran P0 #88 physical touch regression hardening (PR #89, unmerged)
- The existing browser smoke simulated `Element.click()` on a printed ayah path, which could pass even if the polygon was clipped, covered or pointer-disabled. Replaced it with viewport hit-testing via `document.elementFromPoint` and actual Chrome DevTools `Input.dispatchMouseEvent` press/release; the test then requires the note editor to open. This is a stronger browser interaction gate, not yet proof of human touch-device usability.
- Changed `scripts/browser-smoke.mjs` on `fix/88-quran-reader-mobile-interaction`, commit `6fe1890782c493850c10b664a32e93cae4df7e6b`. Existing P0 unit/Chrome and responsive tests remain. Check the exact latest PR head GitHub Actions after subsequent documentation commits; do not merge until green and required review.
- No changes to scripture, secrets, production, R2, payments or student records. Notes remain session-local. Next: inspect real pointer-test CI and 390px screenshots, correct any clipping/hit failures, then request human mobile visual review.

## 2026-10-28 — S04 Quran reader app-shell redesign (issue #90, pending CI)
- Owner approved taking QuranFlash's information architecture as inspiration only, not visual copying. Replaced dashboard wrappers on Quran route with a dedicated reader, compact toolbar, index/settings drawers, large desktop spread, one-page mobile default and retained source-accurate Quran assets, notes, search and drawing.
- Separate per-leaf metadata with clickable verse polygons, so both printed pages of desktop spread are interactive. Navigation: surah selector/604-page input, bookmarks local to session, surah index sourced, settings for single/double/auto and swipe/buttons. Juz precise page source not present: listed as not yet available instead of guessing. No fake licensed tafsir/audio.
- Preserve learner-key reset, R2 preferred and pinned fallback. Local notes/marks are not server-stored, no teacher sync; issue #87. Vercel Preview Deployments remain disabled to protect quota; no per-commit Vercel deploy.

## Quran S08 reciter/player UI — 2026-10-28, branch #92 (pending CI)
- Per owner: defer all PostgreSQL/backend/auth to final platform phase. Add actual reciter player on existing native Next.js reader only. Six Hafs readers from published Mushaf-Learning MIT metadata; verse streams directly from EveryAyah (no copying or storage), user gesture needed. Scope selected ayah/page/full surah, repeat 1/3/5, speed 0.75/1/1.25/1.5, pause/next/previous/seek with live verse highlighting and explicit error handling. No fake word-level timestamps, offline media or teacher sync.
- External audio recordings **not MIT by inheritance**: https://github.com/Mushaf-Learning/quran-audio explicitly disclaims audio redistribution rights; verify upstream streaming permissions before treating site as production-cleared. King Fahd Complex grants app/site use for ITS OWN five Hafs audio sets: https://qurancomplex.gov.sa/quran-audios/ ; those files are a separate, potentially preferred official import and must not be mislabeled as EveryAyah recordings.
- CI includes URL/sequence unit tests + Chrome reciter selector/no-autoplay/rate/repeat panel. Vercel branch previews remain disabled to preserve build limit. No Postgres or APIs touched.

## 2026-10-28 — Quran page-first compact controls (#94, CI pending)
- Owner smartphone screenshot after S08 showed Quran shrunk under audio, toolbelt, footer and redundant metadata. Frontend-only UX fix: 38–40px audio strip, expand-on-demand popover reciter/scope/repeat/speed/scrub, 39px mobile header, 35px icon toolbar, 40px bottom pagination. Reader geometry no longer applies old `audio-open => (100dvh-270px)` override. All controls remain accessible without backend.
- Advanced options float over reading canvas only while explicitly opened; they do not change page dimensions, while collapsed reading remains the default. Real hide/show tools toggles CSS visibility rather than just a label. No autoplay changes and no audio hosting changes.
- Added Chrome short-phone 375x667 geometry assertions: full Quran sheet, audio dock <58px, unchanged sheet after expanding options and all legacy features still present. Screenshot retained in GitHub Actions. Previews disabled on Vercel to preserve daily quota.

## 2026-10-29 — Quran touch, tap, and canonical lesson architecture (#97)
- Owner-approved: subtle 190–220ms page-turn reveal AFTER decoded image swap (fixed image geometry and previous image retained), first same-ayah tap selects/highlights only, second within 450ms opens note; keyboard Enter/Space directly opens note. Same in verse-per-word mode. Added touch marker/pen support: active drawing captures pointer including finger (old condition explicitly rejected touch), transparent SVG pointer target, `touch-action:none` in draw mode only, cancellation not committed.
- Marker/pen options now vertical animated 5-color/pencil/eraser/undo/redo/browse popover under toolbar icon; no horizontal bars or page displacement; reduced-motion styles. Real CDP pointer/touch smoke and 3 interaction unit tests.
- One cumulative canonical Mushaf per learner, teacher-approved lesson layers later merged into it; Notebook shares same Quran renderer but shows only that lesson's pages/ayat and published strokes/comments. See `docs/QURAN_CANONICAL_MUSHAF_AND_LESSON_VIEWS.md`. No false promises of Backend: all Auth/PostgreSQL/RLS/teacher realtime deferred by owner to ONE final integration phase.
- Branch `feat/96-mushaf-page-turn-ink-double-tap`, Issue #97, wait for exact-head green CI before merging. Vercel Preview Deployments remain off to preserve Hobby quota.

## 2026-10-29 — Training/Notebook/Mushaf functional separation, issue #99
- User approved keeping all three sections distinct: Mushaf cumulative personal book, Training = upcoming teacher-approved homework + self-memorization/review + preparation, Notebook = past lesson with published teacher annotations on same shared viewer. `TrainingWorkspace` replaced old stacked Wird+textarea with three accessible tabs and explicitly demo-only teacher tasks.
- Teacher demo assignments now have Quran-specific structured range references (surah 112/113 page 604, exact ayah ranges), reused `ReaderPrintedPage` with bounded source hit regions and source text, reveal/hide cards and optional browser-only microphone playback. No server persistence/transmission, no real teacher submission. Original new learner has genuine blank homework and no booked lesson; voluntary practice is clearly independent.
- Next stage: filtered archival Notebook viewer UI, then remaining student pages; all auth/backend/PostgreSQL remain deferred to final one-shot phase. See `docs/STUDENT_TRAINING_NOTEBOOK_INFORMATION_ARCHITECTURE.md`.



## 2026-10-29 — Classroom booking eligibility hardening (PR #121)
- New D1 triggers reject new scheduled bookings and canceled-slot reactivation/reassignment when the acting teacher is disabled or not qualified. Existing completed historical lessons remain unchanged; qualification is not a substitute for runtime role/presence authorization.
- Added three synthetic SQLite regressions for ineligible insert, canceled reactivation and atomic reassignment/history. Branch commit `f957c31f0e425b44b93cd28e86e4267ec859cee0` contains the code/tests; **exact-head CI remains to be checked** after documentation updates. No remote migration or production changes.

## 2026-10-29 — Classroom implementation begins: 40-minute booking guard (#120 / PR #121)

Owner authorized execution of the full classroom implementation plan #120. A focused **draft/unmerged** PR #121 proposes `0003_teacher_schedule.sql` to enforce 40-minute teacher+learner bookings and no overlaps, with SQLite regression tests. Preserve 30-minute instructional entitlement, manual teacher-only Start/End, and 40-minute calendar interval as distinct concepts. No actual classroom media/sync, scheduler HTTP endpoint, remote migration, or production deployment is claimed. Next: exact-head CI, migration compatibility, then a separate teacher/learner presence and Start/End lifecycle issue/PR; reconcile LiveKit Cloud versus RealtimeKit ADR before media integration.


## 2026-10-29 — Classroom lifecycle policy + audit next PR (#120)

After verified and merged 40-minute calendar PR #121, implement a small separate Worker's **server-input-only** policy module for Sheikh Start/End and both-person connected presence; 30/40 minute alerts never auto-stop the class. Add immutable D1 lesson Start/End ledger and tests; avoid claiming that the pure policy is already a deployed live room. Worker/DO presence enforcement, session-bound teacher API and atomic journal projection are required next. See #7, #18 and #120.


## 2026-10-29 — Real teacher/learner scoped lesson timetable API (#120)

Proposed follow-on PR after #121/#122 adds read-only authenticated Worker timetable routes for teacher and selected learner. Teacher role is resolved from BetterAuth session subject and active qualified D1 teacher row, with assignment or accepted substitute grant for each lesson. Student is limited to the selected learner of an owned account. SQL query tests execute against actual SQLite migration lineage and prevent cross-learner listing. No lesson booking endpoint, verified DO presence, LiveKit media room, actual lesson Start/End HTTP call, or staging deployment is included. Pending CI/merge.


## 2026-10-29 — First teacher portal implementation (feature PR, not yet merged) #45

Owner directs: finish the **complete Sheikh UX first**, then start dedicated classroom UI, designing all teacher states to be implementable in backend. Branch `feat/teacher-portal-full-ux-126` adds responsive RTL Next.js/React teacher routes: home, schedule, students, preparation, reports, assignments and recitations, notifications, attendance/incidents. Uses existing ivory/olive/gold design tokens, typed domain, intentionally **synthetic** academic fixtures and scenario simulations (empty teacher, student/teacher late, disconnect, overtime, consented substitute). Buttons for real live room and audio are disabled; demo-only draft report publish, plan edit, task creation, retry review and provisional no-show are **local memory**, clearly disclosed. Nothing is sent to students, WhatsApp or R2.

Backend wiring guidance is `docs/TEACHER_PORTAL_BACKEND_CONTRACT.md`, with per-screen API, role ACL and state acceptance matrix. Existing read-only `/v1/teacher/lessons` is a separate merged backend capability, **not** connected to this mock UI yet. Need exact-head CI, browser screenshots and PR review before merge. LiveKit keys not needed for building this preview. Next after teacher: classroom UI around existing Quran renderer, then verified DO/LiveKit integration.


## 2026-10-29 — Interactive Quran classroom React preview after Sheikh portal (#50)

Owner asked to complete Sheikh frontend first (merged PR #126), then classroom. Branch `feat/classroom-interactive-preview-127` adds `/classroom`, reusing original 604-page `ReaderPrintedPage` from student public feature boundary. React components provide prejoin teacher+learner presence simulator, Sheikh-only Start/End (including manual End after 40m), teacher Quran page navigation, simultaneous shared pen/highlighter + pause learner + hide shared strokes with local audit, per-ayah teacher error categories, private teacher notes/three independent /10-or-null grades, learner mic mute without remote unmute, student-video dock/float and teacher self-preview hide distinct from camera-off. All media tiles are placeholders and preview role switch is DEMO ONLY; no actual LiveKit stream, DO WebSocket, D1 journal, published report or private student content. Test with Vitest and 360/390/1440 Chrome + screenshot before merge. Detailed future production security and event replay contract in `docs/CLASSROOM_UI_BACKEND_CONTRACT.md`. LiveKit Cloud credentials remain unnecessary until authorized integration.


## 2026-10-29 — Classroom session access-only API slice (#50)

After merged interactive UI preview PR #129, branch `feat/classroom-session-access-130` adds read-only session-verified API access probes to exact scheduled/live lesson. Teacher access requires qualified active acting teacher + unrevoked assignment or positive lesson-bound guardian substitute consent; student/guardian path requires exact active learner and authenticated account. No impersonated role/header/teacher ID from client. Forbidden or ended/cancelled lessons return 404. Authorized response explicitly reports `roomConnected:false`; no media token, room presence, teacher Start/End or audio provider API exists. Python SQL tests against actual SQLite/D1 migrations, exact-head Verify and native local auth smoke before merge. The frontend classroom is still a public synthetic preview, not connected to this API yet.


## 2026-10-29 — owner immersive fullscreen + student mobile camera priority (#50)

After user visually reviewed deployed #129 classroom preview: requested using all available viewport with **NO page scroll**, a prominent "وضع الحصة" fullscreen focus control, straightforward teacher tools, and strong **student mobile** priority Sheikh camera + synchronized Quran. Implemented on branch `feat/classroom-focus-fullscreen-mobile-priority` as CSS viewport-bound layout, fullscreen button with CSS fallback, compact controls, mobile drawer for teaching notes, and phone student order (Sheikh video first, Quran second). Added Chrome checks for no document scroll at 360/390/768/1440, Quran image within stage, video-before-Quran and focus mode. Still preview-only; teacher image is placeholder, and real Quran event sync will be LessonDO. Await exact-head Verify and merge, then re-deploy isolated staging before requesting owner QA.

## 2026-10-29 — Owner APPROVED compact desktop and phone classroom design

Owner said "ممتاز نعتمد" to concept designs of compressed Sheikh desktop three-column lesson and Sheikh-camera-first student mobile lesson. Decision recorded in #50/#120 and `docs/CLASSROOM_APPROVED_DENSE_LAYOUT.md`. Implementation branch `feat/classroom-approved-dense-layout` adjusts existing authentic React preview: slimmer title+presence/timer bands, no redundant big explanatory rows, one-line Quran tools, notes inline with evaluation, more useful video panel area, accessible Quran-side page controls while preserving canonical art, no scrollbar, fullscreen focus mode and mobile student prioritization. Next validation: exact-head GitHub Verify/Chrome and isolated Cloudflare staging visual review; no actual LiveKit or shared DO sync is implied.


## 2026-10-29 — Layout regression after visual QA, substantial fix in progress

Owner provided additional real screenshots showing #132 was **NOT an adequate visual redesign** despite green build/browser smoke. Acknowledge previous false confidence: checks measured overflow/containment but not the physical Quran's actual use of the viewport. Corrective branch `fix/classroom-real-viewport-layout` replaces accumulated CSS with a single layout, introduces opt-in Quran container-height fitting only in classroom, removes redundant waiting banner and unused student desktop pane, constrains camera to a compact mobile hero, and adds hard assertions for pixel-size at short phone heights as well as desktop. Do not claim preview refreshed until GitHub Verify/actual pixel metrics and external Cloudflare staging deployment pass. The real video/persistence/auth scope remains separate.
