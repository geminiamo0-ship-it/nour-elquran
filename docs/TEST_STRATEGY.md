## Classroom #134 compact session viewport (Chrome code-head `b24005ab`)
- [Verify 40912922621](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40912922621) passed repository-policy, governance-tests, code-quality and cloudflare-local-d1 on `b24005ab30e44ab010290cafd328cbd7b76b0c12`.
- Native Chrome exercises mock teacher-only Start/End, Escape-close focus return for preview menu, live/fullscreen layout, all five reachable colors, portrait student camera-first, canonical Quran aspect and no document overflow at 360×667, 390×844, 844×390, 768×1024, 1280×900 and 1440×900. It waits for actual Quran render before screenshots; [artifact 12914517738](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40912922621/artifacts/12914517738) visually inspected.
- Measured Quran width 262/365/474/474px on 360/390/1280/1440, up from earlier 227/330/418/418px. These are synthetic UI geometry checks, **not** authenticated room, device camera, WebRTC, production or staging acceptance.

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

