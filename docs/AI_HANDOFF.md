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
