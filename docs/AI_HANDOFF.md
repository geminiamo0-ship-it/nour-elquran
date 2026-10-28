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

---

## Active handoff — 2026-10-28, PR #58 (draft)
- Scope: approved engineering standard #57, static module import boundary checker and fixture tests only. Branch `chore/57-module-boundary-gate-20261028`; review [PR #58](https://github.com/geminiamo0-ship-it/nour-elquran/pull/58).
- Changed paths: `.github/scripts/check_boundaries.py`, `tests/governance/test_boundaries.py`, `.github/workflows/verify.yml`, `docs/MODULE_BOUNDARIES.md`, `docs/REPOSITORY_MAP.md`, `PROJECT_STATUS.md`, `docs/AI_HANDOFF.md`.
- Local fixture test evidence: 6/6 passed, empty-source checker reported 0 files; **not** an app build or browser test. CI URL and conclusion must be inspected for the final PR SHA after all commits. No merge, app, migration, provisioning or deployment.
- Risk: baseline Python regex checker does not replace TypeScript AST-aware import linting; #39 must add type-aware lint and actual app tests.
- Owner blocker #1: GitHub main branch ruleset/reviews/checks and repository PUBLIC/PRIVATE decision. Do not claim it is configured without settings evidence.
- Next: inspect PR #58 checks and fix failures; get owner review and main protection. Then select #39 bootstrap. Keep future PRs small and feature-first per #57.
