## #309 atomic teacher guard response regression — 2026-11-01

- `workers/api/tests/staff-teachers.test.ts` now simulates the exact `0027_teacher_active_lesson_guard.sql` trigger denial in the legacy teacher role handler (which lacks the new roster preflight), and asserts a deterministic `409 ACTIVE_CLASSES_BLOCK_TRANSITION`, no successful event, and unchanged handling of unrelated D1 failures. The separate Python full-migration SQLite test continues to prove the actual trigger blocks the write atomically; the Node test verifies HTTP-domain error translation. Require exact-head CI and isolated signed Dev verification; no local/remote passing tests claimed by this documentation entry.

## #309 Admin operation release gates (2026-11-01)
- Unit: strict teacher roster transition parser, authorized staff pre-query, active class guard, exact client payload/action allowlist, 401/403, network-uncertain write (no false success/retry), SSR forms locked unless explicit consent.
- Native SQL: all migrations through 0027; active scheduled/live Sheikh cannot be suspended or de-qualified, no immutable event on denial, cancellation then transition, unrelated teacher permitted, and legacy B2 endpoint inherits same trigger.
- Isolated Dev: verified roles.manage staff vs unsigned/guardian/Sheikh/revoked; independent attendance.review grant; D1 audit uniqueness and explicit same UUID replay; all three pages signed and RTL at 360/390/768/1280/1440. Hide real child names in logs/screenshots.
- Block merges/deploy until GitHub Verify at exact HEAD, independent security review and staged 0027 migration + signed remote acceptance. No Production, payment or WhatsApp claims.

## #307 full consolidated safe Admin Phase B source gates

- Backend `workers/api/tests/staff-collections.test.ts`: four immutable SQL selectors and 51-row LIMIT, grant before query, static fields with no contacts/private reasons, strict row types/count/status, no duplicate IDs, zero-row truth, 50-row truncation, D1 malformed result 503. Invalid `view` or extra query parameters 400 before querying D1.
- Browser `admin-collections-client.test.ts`: exactly four typed collection payloads, D1 values only, no role headers/client SQL, no-store signed GET, HTTP 403/bad JSON/network fail closed, rejects unexpected PII fields/coerced counts/duplicate IDs and mismatched collection type.
- UI `AdminCollectionPanel.test.tsx`: four sections use loading gate with no fixture data; only genuine connected nav entries active. Existing default-off static public Admin smoke and signed teacher/overview smoke remain untouched.
- Native disposable `scripts/cloudflare-auth-smoke.mjs`: all four admin views anonymous 401, ordinary Sheikh 403, synthetic signed verified staff 200/no-store, POST 405, unknown/duplicate/extra view 400 and immediate 403 on grant revocation on the same session. No persistent Dev or Production grant.
- After exact-head Verify success, separate pinned-source **Cloudflare Dev** API and Chrome staff/teacher/anonymous role matrix and 360/390/1280 visual tests are required; PR CI does not prove remote Dev or payment/teacher operations. All finance/WhatsApp/recordings/role writes remain OFF.

## #305 staff teacher directory acceptance — 2026-11-01
- Backend Node tests: current `roles.manage` D1 grant must precede all directory SQL; empty list is valid; invalid timestamp/rows/negative counts fail closed; limit 50 + `truncated` with deterministic name/id sort; no contact or learner identities in SQL response.
- Client Vitest: strict typed response, reject extra teacher PII keys, spoofed flags, malformed rows/duplicates, overlong lists; signed same-origin GET only; initial SSR loading not demo records; no client role claims.
- Native disposable local Better Auth + D1 smoke: unsigned 401, nonstaff/forged role 403, verified staff empty then provisioned teacher 200, POST 405, CSRF 403, immediate grant revocation 403. No real student or teacher details. `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm smoke`, `pnpm lint` required through exact-head GitHub Verify.
- Separate signed isolated Cloudflare Dev staff/guardian/teacher and 360/390/1280 viewport acceptance plus independent privacy review required before merging/enabling. All Admin flags default OFF in production; no administrative writes.

## #302 additional fail-closed public-static and revoked identity smoke — 2026-11-01
- `pnpm smoke` (no Chrome) requires successful static HTTP for three /admin routes but forbids the privileged overview title and metrics in HTML unless authorized build gates are explicitly set; this catches accidental default-on Admin exposure before runtime deployment.
- `scripts/cloudflare-auth-smoke.mjs` tests a verified staff session's access is lost (403) not only upon staff grant revocation but also if phone verification is removed or the account disabled, with the same synthetic signed cookie; restored valid conditions regain 200. No remote migration/Worker and no real personal data.
- Remaining: independent GitHub review and separate isolated signed Dev Chrome account/viewport validation before merge or activating the Admin flags.

## #302 supplementary native session/grant freshness gate — 2026-11-01
- In `scripts/cloudflare-auth-smoke.sh`, only a **disposable local** Wrangler .dev.vars enables the read-only admin endpoint. `scripts/cloudflare-auth-smoke.mjs` tests through real Better Auth and D1: unsigned 401, guardian/unverified staff 403, forbidden header claims 403, staff granted `roles.manage` GET 200 (four numeric counts, no names/identifiers), cross-origin GET 403, POST 405, and immediate 403 on grant revocation with the *same signed session*. It must not rely on a source mock or unverified role header.
- UI validation: previously authenticated snapshot is hidden on a fresh AccountSession object even if subject ID is unchanged. Visibility/focus/route changes and cross-tab session notifications abort/clear and force server refresh; a 30s foreground interval bounds stale privilege visibility. Signed browser revocation and actual 360/390 mobile QA remain required **after** source review and Dev-only opt-in.

## #302 protected Admin read-only foundation — mandatory tests
- Source: `pnpm lint`, strict `pnpm typecheck`, `pnpm test`, `pnpm build` + static `pnpm smoke`; exact-head GitHub Verify 4/4, then independent privacy/security review. Do not merge/declare Dev-ready on green unit tests alone.
- Worker: unsigned request 401; authenticated ordinary parent/Sheikh 403, revoked/expired/unverified staff 403 before aggregate query; valid D1 staff `roles.manage` returns only four nonnegative whole-count metrics with `Cache-Control:no-store`; POST 405; missing Worker opt-in 404; D1 outage/schema issues 503, never fake zero. No client role override, user ID list or financial rows.
- Browser: static admin disabled by default, explicitly enable both Worker and Next build opt-ins **only on isolated Cloudflare Dev after owner approval and PR review**; test signed qualified staff/guardian/teacher with role revocation while tab open, no private data on account switch/logout, SSR no mock, no dead sensitive controls, mobile RTL/no horizontal overflow at 360×667 and 390×844, desktop 1280×900, keyboard nav.
- This is not operational Admin acceptance. Keep #302/#21/#22 OPEN until signed Dev E2E and all required review gates pass; full finance/invitation/admin actions are separate issues.

## #244 signed trial cancellation→availability refresh regression (candidate)
- SSR smoke: connected learner lessons render only signed loading/availability states, not local booking preview fixtures.
- Dev E2E still required: book a future trial on synthetic learner A, cancel it >=6h ahead, verify the same open Student Lessons page automatically re-queries D1 availability and offers a valid rebooking slot without manually clicking Update. Confirm cancellation failure does NOT reset eligibility; sibling B never inherits learner A's slots/booking; retries and refresh do not invent success. No payment/provider/media changes. CI alone cannot prove this React effect.

## #244 connected subscription read-only UI (candidate)
- Unit: subscription-ledger-client.test.ts rejects malformed, contradictory or bookable server responses; ConnectedSubscriptionLedger.test.tsx asserts no fabricated counts before signed GET.
- Required gates: exact-head lint/typecheck/Vitest/build; signed isolated Dev D1 0026, owner A / sibling B / foreign owner 404, refresh and mobile 360/390, offline retry. No Production or payments.

## #244 native D1 populated 0023→0024 migration regression (candidate)
- The local Wrangler smoke must build a populated 0022 database **without** accidentally applying future 0024, apply 0023 with the historical Sheikh ink draft, then seed a confirmed trial before 0024 and apply 0024. The test requires `TRIAL_SLOT_ALREADY_BOOKED` on attempted withdrawal, no closure/lesson change on rejection, then a real owner cancellation event followed by permitted staff closure, with FK and migration replay checks.
- Source paths: `scripts/fixtures/trial-slot-native-pre0024.sql`, `scripts/cloudflare-local-smoke.sh`. All actors/data are synthetic, D1 is disposable local. **Exact-head Verify pending**; no Cloudflare Dev or Production assertion. Keep #244 OPEN and do not deploy 0024 until independent review and #286 signed Dev 0023 acceptance.

## #244 combined 0023→0024 source gate (2026-10-31; candidate)
- With P0 ink migration 0023 merged into main, apply this branch's forward-only 0024 via full sorted migrations. Python SQLite asserts both schema markers and all three guards; native Wrangler/D1 CI must run all migrations too. Signed remote Dev 0023 upgrade and signed staff/owner 0024 withdrawal are **not** established by source tests. Independent review, remote Dev acceptance and production permission remain separate.

## #252 ink snapshot truthfulness regression (candidate; no runtime acceptance)
- A DO snapshot must never claim `persistence:'saved'` solely from an empty outbox: historical room-only marks may not have a D1 event. Pending D1 delivery must remain `pending`; only a confirmed append/replay may report `saved`.
- Targeted `classroom-cumulative-delivery.test.ts` covers both a failed D1 write with pending snapshot and a legacy DO-only stroke with feature gate off/on. Run exact-head GitHub Verify and retain #252 open pending signed Dev two-role test and backfill reconciliation.

## 2026-10-31 Signed Student & Sheikh portal Dev acceptance — PASS (scope limited)
- Noor code PR #243 merged main at 604ce1103e824fddb52f16b6621ec04266fbb6da; exact postmerge Verify #41142697961 succeeded 4/4.
- Santoreno QA PR #298 merged as f6eb3f3ae3dfbfa91f098667e78d9f1d4675eada. Full isolated Dev run: https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41143167533 — SUCCESS.
- Actual synthetic browser: anonymous Sheikh receives login, NO fixtures; authorized Sheikh D1 roster/plan and connected preparation; teacher notifications/cases truthful unavailable, staff/unauthorized actor denied; student home/lessons/subscription reflect signed APIs, no fabricated grades or finance state, sibling edit/archive persists, foreign owner 404; responsive RTL 360/390/768/1280/1440 with screenshot artifact noor-profile-remote-browser. Core Dev signed lesson/LiveKit/security smoke also succeeded; Production untouched.
- This confirms the no-fixture boundary and connected existing features, NOT end-to-end completeness of missing business workflows. Master #155 and owner portal audit #242 remain OPEN; #244 genuine booking/entitlements, #245 R2 voice, #246 attendance, #247 notifications, #248 sealed Quran exports are NOT implemented. Never portray empty/disabled interfaces as delivered, no provider payments or automatic WhatsApp claimed.
- Next: close each blocker with signed Worker/D1/R2 and cross-role Dev tests. After all integrations, run full owner visual mobile/desktop acceptance; do not unnecessarily rerun expensive Chrome for docs-only changes.

## Final signed Classroom synthetic Staging E2E PASS — 2026-10-31 / #240
Classroom Dev accepted in the single synthetic run: https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41140055151
App commit: 57c59518a544672fa4c213d81b0e49208f5b2b70; test harness: 5875cc18344cc8871102499945ad8dd2cc3fc0f5.
Verified real signed dual-browser synthetic LiveKit, teacher mic mute/release and learner opt-in, Quran page+ayah sync, ink/eraser and reconnect, mobile screenshots, signed Start/End D1 audit, private correction to report draft, explicit publish and the same approved report after teacher revocation.
6236 pinned Hafs anchors verified. Automated isolated Dev PASS, not human visual acceptance or Production certification; no production data/media was modified.
Tracked feature Issues #231 #232 #235 #236 remain open until owner personal visual QA. Browser screenshots are in noor-profile-remote-browser artifact of the final staging run.
Earlier blockers were fixed by Noor PR #239 (canonical D1 lookup instead of HTTP 503) and Santoreno PR #296 (report revision 2->3: compare exact approved snapshot).
The test checks role isolation 401/404/409, Quran page and exact Ayah, WebRTC, corrections/private drafts, Start and End audit and report history; do not rerun full Chrome suite unless source code or UI changes.

## Dev Quran shared verse 503 remediation — #238 (2026-10-31)
- Single combined staging run [Santoreno #41137769340](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41137769340) successfully deployed Noor main and passed real two-browser LiveKit synthetic A/V, Sheikh mute/release+student opt-in, shared Quran pagination/ink/eraser, phone viewports and reconnect. Failed *after* those at first signed POST Quran selected Ayah (HTTP 503). Do NOT claim completed lifecycle/report yet.
- Fix candidate #238 changes server-side verse-to-page proof from cross-Worker HTTP fetch to the already audited D1 `quran_ayah_anchors` exact `(edition,surah,ayah,page)` row. Edition `hafs-kfqc:v1.1.1`, manifest pinned `864c5474872876b3db8a328d8c74781be83c004a7cdb168ffb4b7eb57477edd2` and 6236 anchors independently reconciled by staging. Wrong page/edition/missing D1 fail closed. No new Quran data or external media and no changes to browser rendering.
- Retest integrated source Verify and then repeat same Dev synthetic complete classroom Start→Ayah→correction→End→report QA; Production remains untouched.

## #235/#236 signed Start/End and corrections — final single-suite plan
- Verify source: strict lifecycle command allowlist (UUID4, start/end only), actor scope, actual DO teacher heartbeat and both participants present, D1 `batch` transactional status + append-only unique audit event with `changes()`, idempotent retry, 30/40min non-auto-end, completed report-draft gate, provider wake after signed END; no unsigned student/owner Start.
- Corrections: exact selected server page/ayah, teacher-only adding and reading, general notes private, invalid kind/page/array/IDs rejected, 120-note cap, replay/mutation conflict, DO storage survives restart, private seed accessible solely after Worker D1 authorization.
- Browser Dev acceptance STILL REQUIRED: two logged-in synthetic clients, Sheikh Start only after BOTH present, Quran verse highlight + marker, Sheikh mic mute/release with learner opt-in, Sheikh real correction log and End, LiveKit participant removal acknowledgement (including outages/rejoin), report draft prefilled and manual approval/publish; mobile 360x667 and 390x844 no outer scroll. NO Production.
- Run exact HEAD Verify once after final code+docs changes; do not claim real browser acceptance based solely on CI.

## Owner QA #231 / #232 source checks (2026-10-30)
- Mute/release: GitHub Verify https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41132499065 SUCCESS 4/4. Covers signed DO moderator state, idempotency, wrong role/expired lease and mocked provider confirmation; no real mic permission test.
- Surah/Ayah navigation: GitHub Verify https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41134677808 SUCCESS 4/4 before docs updates. Exact publisher verse polygons, signed server verse-page proof, student read-only shared state, stale receipt/authorization checks, frontend unit and local D1.
- Still required: Dev two-account test selecting Al-Baqarah 2:255/page 42, highlight in both browsers and on reload, mobile 360/390 narrow layout, teacher mute/release and learner opt-in reactivation including permission failure and reconnect. Neither main nor Production changed by draft PRs.

## CR-02B2 signed mute no-secret Dev PASS (2026-10-30)
- Noor exact main Verify #41002079116 PASS 4/4, Santoreno real no-secret Dev #41002323938 PASS: Sheikh signed mute 503 with no provider secret, forged unmute/SID 400, learner 404, anon 401, GET 405; CR-01, CR-02A, 07A, 08A, 08B1 regressions PASS. No actual provider ListParticipants, MutePublishedTrack, RemoveParticipant, guardian consent or 2-device media. Provider ACK/ejection and real lesson End still outstanding #206.

## CR-02B2 #206 post-write wake and teacher mute tests (source-only)
- Unit tests confirm server-only exact role/lesson reconciliation, invalid private DO room, signed Sheikh + fresh DO lease for microphone mute, server-sourced learner identity and MIC track SID only, `muted:true` never remote unmute/camera/screen share, independent RoomService JWT HMAC, no-secret 503, provider failures fail-closed. Existing CR-01/CR-02A/CR-02B1, report, notebook, D1 and Next build must stay green. Real LiveKit Cloud service ACK/participant moderation and actual signed End writes still outstanding; Admin last.

## CR-02B2 first source acceptance (2026-10-30)
- Exact PR Verify #40999824319 PASS 4/4, postmerge #40999944470 PASS 4/4. DO read-only snapshot regression fixed before merge; simulated provider/DO tests cover revocation queued durable outbox and expiry. Isolated Dev no-secret smoke from Santoreno #267 is distinct and may only verify public action/credential denials, not provider API effectiveness. Real LiveKit room removal/participant token cutoff, direct write-time hooks, user device A/V, mute-only and timing SLA remain open #206.

## CR-02B2 #206 server-side media eviction source gates
- Fast Node tests independently verify scoped HS256 RoomService JWT and expected HTTPS Twirp payload/revoke_token_ts, denial on bad provider response/timeout; SQLite DO alarm tests prove persistent pending removal across restart and provider outage, 25s lease expiry, revoked teacher D1, pending reconnect fence and no client-supplied provider IDs. Regression CR-01, CR-02A/2B1, D1+Next build. Actual LiveKit credentials/ACK, provider-side 2-device eviction, teacher mute-only, instant write-path revocation and child privacy are NOT accepted and MUST be separate before release.

## CR-02B1 #204 LiveKit browser SDK test plan (source only)
- Exact pinned lockfile frozen install, TS/ESLint/Vitest strict media ticket parser and denial responses, Next SSR/build + local D1. Unit tests intentionally use synthetic tokens and **no** real provider credentials or devices. Browser LiveKit capture/reconnect and permission test needs one targeted 360px/390px/desktop QA and real signed two-device Dev. CR-02B2 provider-side eviction of already-connected revoked students/Sheikh mandatory before media credentials injected for real users. Existing CR-01 and 07A/08A/08B1 regression smoke separate; no default Chrome.

## CR-02A actual no-secret Cloudflare Dev gate (2026-10-30)
- Noor main Verify #40996405754 4/4 success; Santoreno #40996681563 synthetic signed two-role DO joins plus media-token POST returned **503 LIVEKIT_NOT_CONFIGURED/no token**, forged identity/room/grants body 400, foreign 404, anonymous 401, GET 405, no-store; 07A/08A/08B1/CR-01 regressions PASS. No provider-level A/V attempt without owner account. This is not proof of LiveKit media quality, connected-user revocation or child consent; keep CR-02B open.

## Classroom CR-02A media join JWT backend candidate (#200)
- Node tests verify independent HMAC signature of minted HS256 JWT, 120s TTL/opaque subject, grant whitelist camera/mic only with no roomAdmin/record/data, invalid/absent secrets and URLs, D1 scheduled admission and signed self DO heartbeat. GitHub Verify exact head before merge. Isolated Dev no-secret test must confirm signed clients 503/no token and forbidden 404/401, no LiveKit resources accessed; real two-device A/V and connected-user eviction/guardian consent separate CR-02B. No default heavy Chrome.

## Classroom CR-01 remote Dev proof (2026-10-30)
- Exact Noor main Verify #40993668189 4/4 success, Santoreno Dev #40994099005 success: two signed actors, DO heartbeat/leave/rejoin/25s expiry, no fake Start/AV, foreign/sibling 404, anonymous 401, malformed public body 400. Checks followed by 07A/08A/08B1 regression PASS. This is **server API** evidence, not live two-device audiovisual or RTL/mobile screen acceptance; keep LiveKit and Classroom END separate.

## CR-01 (#196) waiting-room candidate gates
- Node reducer tests: signed role-only actions, explicit join, independent teacher/learner leases, wrong actor 409, heartbeat without join 404, disconnect expiry, leave/rejoin, no Start/End and durable reconstruction; missing DO binding always 503. Exact-head GitHub Verify and API/Web/Worker TypeScript & build; optional local DO native smoke only when DO migration/binding supported.
- **Dev acceptance pending:** isolate a new real Cloudflare DO binding on the Noor Dev Worker only, verify signed two-account synthetic join/heartbeat/leave/revocation and expiry, then a single targeted mobile RTL waiting-room QA. No production, no Chrome on every PR and no real minors/video.

## Phase 08B1 #192 sealed lesson Quran archive (source not yet staged)
- SQLite migration 0015 and Python tests check real END+published report authorization, fixed edition and FK-backed Quran ayah anchors, bounded page/mark/coordinates, archive cannot be modified after one-way seal, prior report revision hidden when newer report published.
- Strict browser client tests reject tampered canonical edition/anchor/page/ink and version mismatch; React uses read-only shared Quran renderer. Fast exact-head Verify + future isolated signed Dev GET owner/foreign/anonymous with synthetic D1 manifest only. No default Chrome, media assets, PDF, payment, live Classroom or real child records.

## Phase 08A #190 notebook candidate (not yet Dev accepted)
- Fast Node/Python SQLite: strict UUID and note body, historical owner/lesson linkage, explicit completed+END, cross-sibling/foreign/Sheikh denial, atomic revision CAS, idempotent event replay, hide tombstones and immutable events. Student client DTO tests.
- Next release gate: exact-head Verify + isolated Cloudflare Dev D1 0014 signed session ownership and authoring/read-after-refresh, then targeted visual UI/RTL owner acceptance. No blanket Chrome in CI, no real minors, no R2 audio or public links.

## Phase 07A remote Dev API acceptance (2026-10-30)
- [Noor main Verify #40986308630](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40986308630): 4/4 success after merged PR #187 at exact SHA `fedc03a8aa89e04a8080e5210840a93bf900027c`.
- [Santoreno remote Dev #40986426733](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40986426733): deployed existing isolated Worker and D1 with 0013; authenticated synthetic roster/staff book + Dev-only classroom lifecycle event; draft/private, published revisions, CAS/replay, latest approved, independent 0/null/10 scores, revoke denied 404, foreign 404; Phase 05A/05B/06A1 regression pass. **Not a real Classroom/live presence test**. Browser UI not yet accepted, default Chrome OFF.
- Next: targeted connected Reports/Progress RTL/mobile/keyboard visual check with only synthetic data, run once on demand. Staging must never use real minors/voice or production credentials.

## Phase 07A #186 report gates — NOT YET VERIFIED ON DEV
- Fast Verify must run strict TS and Python SQLite report journal tests. No default Chrome. Validate completed lesson **with real END audit**; draft invisible to student, publish immutable, new draft preserves prior approved, CAS 409, independent 0–10/null scores, unassigned/revoked teacher and substitute +24h denial.
- The merged-code run or this status text **does not prove** a staged API. After exact-head CI, stage additive 0013 on isolated Dev, exercise signed Better Auth owner/teacher/foreign owner/expired substitute across the two read paths and one mutation path, then obtain targeted 360/390/768/1280/1440 screenshots if accepting UI. Never run with real child data or simulate production attendance.
- See `docs/LESSON_REPORTS_PHASE_07A_CONTRACT.md` and `docs/adr/0008-admin-last-teacher-onboarding.md`. Admin Dashboard and Classroom are separate future gates.

## Phase 06A1 real isolated Dev smoke — safety-denial acceptance (2026-10-30)
- Noor source [PR #183](https://github.com/geminiamo0-ship-it/nour-elquran/pull/183) and [PR #184](https://github.com/geminiamo0-ship-it/nour-elquran/pull/184) postmerge fast Verify passed. Santoreno [PR #255](https://github.com/geminiamo0-ship-it/santoreno/pull/255) postmerge Verify [#40979386814](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40979386814) PASS and **real Cloudflare Dev [#40979386785](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40979386785) PASS**: migration 0012 and lock triggers verified on dedicated D1; owner account has two synthetic learner profiles that each return `uploadEnabled:false` and no-store; foreign/anonymous 404/401, POST grant 405, asset rows 0. Other 05A/05B remote assertions still pass, default Chrome OFF.
- Security check does not prove guardian verification, retention policy, actual byte upload, private R2 bucket or media cleanup, and **does not approve real voice recordings**. Keep #180 open until those gates pass; optional visual QA remains owner-managed.

## #180 runtime media helper regression (2026-10-30; source-only)
- `workers/api/tests/private-recitation-audio.test.ts` now asserts private R2 keys reject forged descriptors (submission ID, byte cap, duration, SHA, MIME) and array-coerced learner IDs even when TypeScript is bypassed. Playback headers must reject runtime `text/html`, MIME parameters and unsupported types before response creation.
- Run in fast backend Node tests and exact-head Verify. This does **not** test actual media bytes, consent, R2, guardian identity or Dev upload; the feature remains hard-disabled.

## Phase 06A1 #182 — private audio **hard-disabled** source gates
- Additive SQLite `0012_recitation_audio_privacy.sql` is executed by every migration replay; `test_recitation_audio_privacy.py` proves SQL rejects guardian grants and asset reservations, owner-scoped immutable withdrawal metadata and wrong-submission or public-link metadata in a disposable synthetic unlocked schema.
- `private-recitation-audio.test.ts` covers UUIDv4 key formation, strict type/size/duration/SHA-256 and non-cacheable response headers. These are envelope checks, **not real binary sniff, R2 upload or anti-malware guarantees**.
- `scripts/cloudflare-auth-smoke.mjs` calls `GET /v1/me/learners/:id/recitation-audio-policy` via actual local Better Auth/Worker/D1 to assert owner 200 disabled, foreign owner 404, signed-out 401 and POST 405. Chrome is not required for this server-only source change.
- [Privacy contract](PRIVATE_RECITATION_AUDIO_CONTRACT.md) lists unresolved guardian verification, age, retention, deletion/export, private R2 provisioning and actual Dev media/security acceptance; **never present #182 as voice-recording availability**.

### One-time remaining UI acceptance for #173 / #178 (not a default CI gate)
1. On the existing Dev site, sign in as synthetic qualified assigned Sheikh, open `/teacher/assignments/`, select verified assigned learner and publish one existing Hafs range; confirm only server-confirmed task appears after refresh.
2. With synthetic household account, select target learner in `/student/training/`, see the new task and the right Quran range; sibling/foreign owner cannot see the task.
3. Submit one short note using the explicit button; verify spinner/ACK, reload and pending status. Sheikh opens only that task, requests retry; student sees feedback, submits attempt two; Sheikh accepts; reload preserves both attempts.
4. Verify signed-out demo remains marked as a preview, revoked teacher shows access denied rather than fixtures, error/offline and double-click states don't report false success.
5. Inspect RTL/mobile overflow and readability at 360×667, 390×844 and 1280×900 using **one targeted manual browser QA**. Never run both generic Chrome suites on every commit. Voice playback/upload not tested until #180 privacy gate.

## Phase 05A/05B native Cloudflare Dev evidence — no default Chrome
- Published task Noor #173 API accepted: [Santoreno remote #40971275548](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40971275548), 0010 D1, canonical Hafs and owner/teacher 404/409/idempotency.
- Student explicit submission/teacher review Noor #178 API accepted: [Noor push Verify #40974982514](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40974982514) 4/4 and [Santoreno #40975149637](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40975149637) real Dev D1 0011, owner submit, attempt replay 200, conflicting attempt 409, teacher retry, second attempt, accept, permanent immutable history, foreign owner 404 and revoked teacher 404.
- **The passing runs do not cover new connected assignments/review browser UI.** #173/#178 retain that targeted release gate; make one explicit browser QA run only when validating UX, not on every source change. No child voice upload, guardian consent or R2 tests yet.

## CI policy from #171 — fast security checks + optional browser QA (2026-10-30)
- Owner requested less redundant CI overhead. Default `.github/workflows/verify.yml` keeps repository policy, governance, ESLint/architecture rules, TS checks, unit/integration tests, production build, HTTP smoke, isolated real Cloudflare-local D1 migration/readiness and Better Auth session/owner API tests. **These run on every PR and main push.**
- The prior *two* full Chrome journeys (static responsive screenshot and authenticated same-origin account Chrome) and a redundant connected-account Next rebuild are **not** in default Verify anymore. A green fast Verify proves code/native D1/auth gates only, **not** browser appearance, keyboard interactions or deployed E2E.
- `.github/workflows/browser-qa.yml` → GitHub Actions → **Browser QA (on demand)** → Run workflow, choose `static`, `account`, or `all`. It uses the exact selected Git ref, synthetic local credentials and output screenshots retained for 14 days. This optional manual check is required for visual/UI-heavy change acceptance, actual auth/teacher-state browser flows or pre-release, but **is not a required check for every commit**.
- Cloudflare Dev remote Chrome and role/owner acceptance remain targeted *staging release gates* on the existing worker; they are not a substitute for default fast auth/data tests. A manual browser test must be run and linked before closing an issue whose acceptance explicitly depends on visual/full-browser verification.
- No real minors, phone delivery, payment or Production data in any suite. If a browser suite fails, don't treat static build success as a passing visual acceptance.

## Profile lifecycle #157 — proved on dedicated Cloudflare Dev
- Additive D1 migration `0008_learner_profiles.sql` and native SQLite tests: atomic owner/subject/CAS, replay, no-edit, immutable old/new audit, archive preserved history, reject schedule/live class archive.
- Better Auth/Worker native synthetic smoke: owner A/B, `POST /v1/me/learners/:id/profile-actions`, 401/403/404/409, UUID replay, refresh; connected Chrome tests edit/archive and five responsive RTL viewports.
- [Noor exact main push Verify 40958071853](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40958071853) SUCCESS; [Santoreno real Cloudflare Dev run 40958341460](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40958341460) SUCCESS using `noor-site-staging` and `noor-core-staging`. Remote browser screenshots artifact `noor-profile-remote-browser` ID 12934533154; tested 360×667, 390×844, 768×1024, 1280×900, 1440×900 with no horizontal overflow.
- Real phone ownership, guardian consent and recovery are **not tested**; production is not enabled. Treat local and remote test success only as Phase 01A functional acceptance, not complete Phase 01. #160 tracks narrow mobile visual clipping.

## Private Quran #149 hydration guard

- `private-mushaf-readiness.test.ts` checks that connected writes are allowed only when index and page are hydrated for the selected learner and active page, and denied after failure or during a page/learner switch; local demo remains editable. Run with `pnpm --filter @noor/web test` and strict typecheck in Verify.
- Separate protected QA Chrome/D1 proof must simulate a slow page fetch, page navigation, failed POST + Retry, two-account isolation and actual reload; unit tests alone do not establish remote persistence or zero-loss before ACK.

# Verification and test strategy

## AUTH-02 #112 full local account journey
- Vitest: validate/strip session/profile responses, reject demo/duplicate/malformed identities, fixed same-origin cookie requests, HTTP/offline/invalid-JSON failure and connected snapshots without fixtures. Existing frontend, backend, static build and Chrome checks retained.
- `bash scripts/cloudflare-auth-browser.sh` after `NEXT_PUBLIC_ACCOUNT_UI=true pnpm --filter @noor/web build`: real Chrome + composed Worker + isolated D1. Drop the first successful profile POST response, recover by reload without duplicate signup/insert; then exercise HttpOnly/SameSite cookies, 360/390/1440 registration/dashboard, add/switch siblings, logout/replay, second account isolation, wrong password and expired sessions. Screenshots contain synthetic fixtures only.
- Local native gates do not prove remote settings, contact verification/recovery, real consent/adult identity, child/staff scope, lessons or production readiness. Test config/secrets are ephemeral; no remote commands.

## AUTH-01 #110 native local acceptance
- `pnpm test:backend`: 26 dependency-free Node tests (including E.164/Egypt normalization, strict HTTPS opt-in and bounded JSON) plus 22 SQLite core tests. These alone do not execute Better Auth.
- `bash scripts/cloudflare-auth-smoke.sh`: installs no remote resources; runs pinned Wrangler on isolated local D1 with both migrations and a temporary secret. Requires installed root dependencies. Tests real Better Auth signup/phone login, HttpOnly/SameSite cookie, wrong password, account/learner ownership, forged identity rejection, body-key and origin restrictions, profile cap, blocked raw auth routes, logout replay, disabled account and expired session rejection.
- Verify retains default-disabled native migration replay and all existing lint/type/unit/build/HTTP/Chrome gates. Synthetic local acceptance is separate from cloud staging, real phone delivery, recovery, child-session policy and browser auth integration.

## #46 native Cloudflare-local verification gate (unmerged)
- Dedicated Verify job `cloudflare-local-d1` uses pinned Wrangler 4.45.0, isolated temporary persistence, applies the D1 migration twice, starts the Worker locally with the same D1 binding, and asserts /health 200, /ready 503 with `database: ready`, forged /v1 503, and unknown route 404.
- Fail-closed is intentional until real auth exists. This tests native **local** Worker/D1 rather than only Node/Python emulation; it does not establish remote D1, production configuration, cookie/session validation, billing or PITR. Verify exact head and do not count a queued/failed job as a pass.


## CF-01 backend gates (#104)
- Root lint covers workers/api; typecheck checks Worker/tests with strict TS; build emits API code; root test runs Node request/policy and Python SQLite migration/ownership/transaction/export-restore cases.
- Fake identity headers never reach learner data. Cover account/learner scope, private notes, staff limits, accepted substitute lesson, immediate brief expiry and fixed first-publication correction window.
- SQLite tests prove schema behavior locally. Native D1 batch/races, Workers auth/cookies, DO restart/replay, PITR and RealtimeKit/hosting require separate staging evidence; do not infer them from CI.
- Whole-platform recovery: [runbook](CLOUDFLARE_BACKUP_AND_RESTORE.md); restore must reconcile D1/R2/DO and external provider effects.

## Historical verification notes


## Foundation (present now)
- Every PR and main push run Verify repository-policy and governance-tests.
- Verify required read-first/handoff/policy/template files exist.
- Validate no tracked secrets or conflict markers; reject symlinked required governance files.
- Validate relative markdown links; validate GitHub YAML parses; check PR description references a GitHub Issue.
- A test verifies the policy checker catches a missing required file, invalid link and tracked secret.
- DO NOT report app lint/build/playwright as passed when there is no app yet.

## Application gate (automatically mandatory after root package.json exists)
- Package manager + lockfile deterministic install.
- lint, typecheck, test, build and smoke scripts must be defined and invoked in CI.
- Add a workspace bootstrap Issue before package.json appears; that Issue supplies runnable tests and app setup.

## Future feature-specific gates
- Frontend: Playwright mobile 360/390px & desktop, RTL reading order, keyboard navigation, low-network classroom placeholder, stateful mock flow. Screenshot baseline reviewed by humans.
- Auth/profile: cross-account and sibling isolation, role matrix, guardian delegation and PIN/re-auth protection for payment/account changes.
- Scheduling: simultaneous overlapping booking attempts, timezone/DST, cancellations/idempotency.
- DO/Queues: duplicate events, restarts, outages, monotonic versions, D1 reconciliation.
- RealtimeKit: actual browser mobile/audio/video/network recovery; concurrency and bandwidth measurements; microphone permission denial.
- AI: report-to-JSON schema, Qur'an ayah range and riwayah checks, no inventing verses, teacher acceptance, adversarial data and child safety.
- Operations: dependency scanning, secrets, rollback plan, observability, live staging acceptance.

## Status
No app runtime, browser tests, DO stress tests or LiveKit load tests have been executed in this foundation-only phase. Add evidence to issue/PR for each future test.

## CORE-01 branch-only browser gate (verified at SHA `1f312a54`)
- Draft PR #60 adds a real headless Chrome production-page smoke script with 360px, 390px and 1440px viewports, Arabic RTL and no horizontal overflow assertions.
- GitHub Actions uploads screenshots as an artifact for **human visual review**; screenshot generation does not automatically approve the design, keyboard navigation, contrast or accessibility.
- Existing HTTP smoke and unit/build checks succeeded at exact earlier SHA `392bff47` ([run 40680982177](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40680982177)). Browser script passed on exact head `1f312a54a39f13210c054313a20e25fe38124791` ([run 40694813876](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40694813876)), including screenshot artifact upload (ID `12818582438`). The 360/390/1440 PNGs were downloaded and visually inspected for basic legibility/clipping; newer commits need separate CI.
- Full Playwright E2E, registration journeys, role isolation, backend auth and vinext/Cloudflare staging remain separate future gates; do not imply they were run.

## CORE-01 / #57 route module boundary regression (unmerged)
- `tests/architecture.test.mjs` exercises route-to-feature **public index only** imports. Negative fixtures include alias, relative path and dynamic `import()` deep-import bypasses; a positive fixture uses the feature's public index.
- The AST architecture scanner runs in `pnpm lint`, and these tests run in `pnpm test` on the #39 branch. **Verified** on `51fbde724dac1f9a424f210d953986d47e2f983e` / [Verify 40698369854](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40698369854) (all three jobs success, including architecture tests, production build and Chrome smoke). Recheck later documentation commits separately.

