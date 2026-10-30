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

