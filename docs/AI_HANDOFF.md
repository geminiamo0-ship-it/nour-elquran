# AI agent handoff contract

Every session starts by reading AGENTS.md → PROJECT_STATUS.md → NOOR_MASTER_PLAN.md → guardrails → active issue → GitHub PRs and workflows. Never infer changes from chat alone.

## Before implementing
- Confirm exact repository, branch and HEAD SHA.
- Verify an active Issue exists and all dependencies/acceptance criteria are recorded.
- Inspect all relevant real files, workflows and migrations.
- If work scope isn't approved, discuss first; document proposals without implementing.

## During work
- A branch per Issue, descriptive commits with issue reference.
- Keep running notes in issue comments for key decisions and blockers.
- Update the map, status and ADRs when responsibilities or architecture change.
- Keep user-visible outcomes separate from internal assumptions.

## Required completion note
1. Issue # and linked PR #, exact SHA / merge SHA.
2. Changed paths and their ownership.
3. Local commands and real exit results; GitHub Actions run ID/URL and conclusion.
4. Actual browser/staging/production evidence by environment.
5. Migrated/deployed resources (or explicitly "none").
6. Known failures, unverified assumptions, security findings.
7. Next exact step / proposed Issue and any decisions owner must approve.

Never write "verified" if the workflow is queued or missing. Never merge without review/checks just to claim completion.


## Working implementation handoff — 2026-10-28 (unmerged)
- Active Issue #39. Source branch: `feat/39-bootstrap-workspace` (do not push main). Engineering quality approval #57; Next/Cloudflare runtime adapter remains under separate #40 spike.
- Written: root pnpm workspace config; `apps/web` minimal Next App Router + React/TypeScript app; bootstrap feature with Arabic RTL; shared UI; TypeScript/Vitest/ESLint/Prettier; architecture boundary and cycle script/tests; production Next HTTP smoke script.
- No real auth/API or child data. The displayed page must say this is foundation UI only.
- Local runner has Node 22 but no npm registry DNS resolution; cannot certify `pnpm install`, Next build, Vitest, browser render or Playwright locally.
- **Do not consider code verified until GitHub Actions passes at exact branch SHA**; release no production deployment. Generate lockfile remotely, inspect real CI, then open review PR. If checks fail, leave #39 open and record actionable failures.
- #1 PR review/required check branch protection still requires GitHub settings verification. Repo PUBLIC per owner.

## 2026-10-28 — browser acceptance gate added to draft #60
- Prior verified SHA: `392bff47f9449c1009d271ddbea188f235cdc255`, [Verify 40680982177](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40680982177) success (frozen install, lint, typecheck, tests, build, HTTP smoke).
- New browser work on the same **unmerged** `feat/39-bootstrap-workspace` branch: `scripts/browser-smoke.mjs`, `package.json` `browser:smoke`, `.github/workflows/verify.yml` Chrome run + screenshots artifact. Tests real production Next in headless Chrome at 360/390/1440, RTL, heading, demo notice and horizontal overflow. No new dependency or paid service.
- **Actual browser evidence:** head `1f312a54a39f13210c054313a20e25fe38124791` passed [Verify 40694813876](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40694813876), including Chrome 360/390/1440 and screenshot upload. Artifact ID `12818582438` was downloaded; screenshots visually inspected for legible Arabic RTL and obvious clipping. This is **not** a final landing/keyboard/accessibility acceptance. Recheck CI for any newer documentation commits.
- After green CI, visually review screenshot artifact; record acceptance separately. Branch protection #1, PR review and #40 vinext spike remain pending. No production deployment.

## 2026-10-28 — route-to-feature public API gate (#39/#57)
- On unmerged draft PR #60, extended `scripts/check-architecture.mjs` so `app/**` may only import a feature's `index.ts(x)` public API, not internal components, including relative and lazy imports. `tests/architecture.test.mjs` supplies synthetic allowed/forbidden examples.
- Prior exact-head CI evidence: `3dbe0cf562248331cfee89298dce6a36b6d5a3cb` / [Verify 40695487092](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40695487092) succeeded **before** this change. New code requires a fresh exact-head run. Do not merge #60 or #58 without overlap review, main protection #1 and required human review.
- No external provisioning, paid services, secrets, real student data, migrations or deployment.
