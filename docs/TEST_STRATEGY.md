## #149 developer-only Quran QA target safety

- `.github/workflows/quran-dev-qa.yml` is limited to pushes on the dedicated #149 QA branch and manual dispatch. It runs a real Chrome pointer/D1 journey on the existing developer Worker only (not production), and uploads short-lived synthetic screenshots. Its success is a separate gate from normal Verify and the Santoreno API smoke; never infer mobile S Pen hardware or crash-safe offline behavior.

- `node --test tests/quran-qa-target.test.mjs` verifies the synthetic Chrome runner requires `NOOR_QA_RUN_SYNTHETIC=yes` and the exact `https://noor-site-staging.<account>.workers.dev` origin. It rejects the public frontend, legacy QA host, alternate domain, URL path/query, insecure HTTP and missing opt-in.
- Once the existing Dev site is independently confirmed deployed with verified canonical D1 anchors and private save enabled, the manual `NOOR_QA_ORIGIN=https://noor-site-staging.<account>.workers.dev NOOR_QA_RUN_SYNTHETIC=yes node scripts/noor-quran-qa-browser.mjs` exercises synthetic accounts/Chrome/D1. It **writes synthetic records** to the isolated development database, so never run it on production. This source-only change does not constitute a remote pass; page-turn-during-fetch, failed POST/Retry and multi-device proof remain separate.

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

