# Verification and test strategy

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
- DO/Queues: duplicate events, restarts, outages, monotonic versions, Postgres reconciliation.
- LiveKit: actual browser mobile/audio/video/network recovery; concurrency and bandwidth measurements; microphone permission denial.
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

## CF-01 backend foundation checks (#104; PR branch only)
- Root lint covers `workers/api/src` and tests. `pnpm typecheck` includes standalone strict backend TS; `pnpm test` includes Node 22 Worker request and actual in-memory SQLite migration tests with foreign keys enabled.
- Negative tests must reject forged identity, unavailable D1, cross-learner annotation references, unassigned teacher lessons, duplicate operation IDs and invalid JSON. Positive tests cover health/readiness and replayable migration.
- These checks do **not** verify Cloudflare production runtime, D1 Time Travel, account authentication, query authorization or real R2/DO backup. Those remain acceptance gates in #104/#46/#56.
