# Contribution workflow — Noor Al-Quran

## Read before any change
AGENTS.md → PROJECT_STATUS.md → NOOR_MASTER_PLAN.md → docs/ENGINEERING_GUARDRAILS.md → active GitHub Issue.

## Exact workflow
1. Open or locate a detailed Issue before modifying files.
2. Include problem, current behavior, requested behavior, file/contracts likely impacted, examples, mobile states, accessible UI expectations, acceptance checklist, tests, security, risks and dependencies.
3. Create a focused branch (feat/ISSUE-short-name, fix/ISSUE-short-name, chore/ISSUE-short-name).
4. Make descriptive conventional commits **with Issue ID**. Example: feat(training): implement local exercise progression (#42). In body explain motivation, affected paths, test evidence and follow-up when non-trivial.
5. Open a linked PR using the template; prefer draft until locally verified.
6. Inspect exact HEAD SHA and GitHub Actions Verify; document run URLs, real results, UI screenshots for frontend and runtime behavior. CI green alone is not evidence of visual/product acceptance.
7. Review diff and test coverage; document ADR for architecture changes and update repository map.
8. Update PROJECT_STATUS and issue comments/checklist in same task.
9. Merge only after required checks, reviewer approval where required and acceptance; prefer squash merge with traceable final message.
10. Post-merge verify main and record actual merge/deploy state. Close Issue only after stated acceptance is really fulfilled.

## Mandatory test classes once app exists
lint; strict TypeScript; unit tests; integration API/auth/state; Playwright mobile+desktop E2E; accessibility and Arabic RTL; security/profile isolation; relevant concurrency/idempotency; production build. A failure is not a pass. See docs/TEST_STRATEGY.md.

## Handoff / evidence
Never write "done" merely because code was pushed; separate coded/tested/merged/deployed/production-verified. If blocked, leave Issue OPEN with exact failing check, stack trace/reference, likely owner and next action.

## Branch protection
The GitHub web settings must require checks and PR review (see docs/CI_BRANCH_PROTECTION.md). A workflow definition alone does not enforce PR-only merges; never assert settings are enabled without checking them.
