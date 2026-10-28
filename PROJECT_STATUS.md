# PROJECT_STATUS — verified handoff state

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

## 2026-10-28 — #43 native React landing refactor (UNMERGED / UNVERIFIED)
- The previous #64 landing implementation merged, but it rendered HTML fragments with `dangerouslySetInnerHTML` and loaded `landing-v3-interactions.js`; passing CI did not make it a maintainable native React implementation.
- New branch `feat/43-native-react-landing` replaces all 14 landing section HTML injections with JSX, removes the imperative public script, uses React state for mobile navigation, enrollment/sibling profiles, dashboard tabs and mock bookings, and canvas drawing/notes. The demo remains in-memory only; no real account, class or private data storage.
- New regression test `tests/landing-native.test.mjs` and updated Chrome interaction smoke exercise controlled inputs and modal lifecycle. **No CI result is claimed for this branch until its PR workflow completes.**
- Next: open PR linked to #43, inspect exact-head lint/typecheck/unit/build/Chrome evidence, fix failures, review UI screenshots, and keep PR unmerged pending review/acceptance. #1 main ruleset still unverified.
