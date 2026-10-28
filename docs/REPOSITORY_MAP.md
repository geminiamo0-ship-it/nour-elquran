# Repository map and file ownership

This is a **foundation-only repository**. The following existing paths are real:
- AGENTS.md: agent mandatory start.
- README.md: navigation and actual high-level status.
- PROJECT_STATUS.md: verified project continuity and next action.
- NOOR_MASTER_PLAN.md: agreed direction and unresolved decisions.
- CONTRIBUTING.md: Issue→PR→tests→merge policy.
- docs/ARCHITECTURE.md: proposed layer boundaries.
- docs/DESIGN_SYSTEM.md: owner-approved landing visual identity, tokens, components, section order, CTA and signup behavior.
- docs/ENGINEERING_GUARDRAILS.md: security/architecture invariants.
- docs/REPOSITORY_MAP.md: this authoritative map.
- docs/TEST_STRATEGY.md: verification matrix.
- docs/SECURITY_PRIVACY.md: minors / privacy constraints.
- docs/AI_HANDOFF.md: transfer instructions.
- docs/CI_BRANCH_PROTECTION.md: GitHub checks & settings procedure.
- docs/adr/: architecture decision templates and records, including ADR 0001 governance and ADR 0002 managed LiveKit Cloud + interactive mushaf.
- .github/workflows/verify.yml: initial real governance-only checks, conditional code quality once workspace exists.
- .github/scripts/verify_repo.py: repository policy gate.
- tests/governance/: tests for the gate.
- .github/ISSUE_TEMPLATE/: feature/bug/tech issue templates.
- .github/PULL_REQUEST_TEMPLATE.md: evidence checklist.
- .github/dependabot.yml: Actions dependency updates; npm added after scaffold.
- .github/CODEOWNERS: owner review hints (not enforcement without ruleset).
- .gitignore: prevents common local secrets and build artifacts.

## #39 bootstrap feature branch (pending PR review)
The following paths **exist on `feat/39-bootstrap-workspace` only**, and must not be represented as merged before CI and PR review:
- `package.json`, `pnpm-workspace.yaml`, `.npmrc`: pinned pnpm workspace and top-level test/build scripts.
- `apps/web/`: minimal Next.js App Router Arabic RTL application, not the final landing page.
- `apps/web/src/app/`: thin route composition, HTML language/layout and global brand tokens.
- `apps/web/src/features/bootstrap/`: one page-specific component and a render unit test.
- `apps/web/src/shared/ui/`: reusable stateless panel primitive.
- `scripts/check-architecture.mjs`: feature boundaries and cycles; `tests/architecture.test.mjs`: rules rejecting illegal imports.
- `scripts/smoke.mjs`: production Next server HTTP smoke (requires successful install and build).
- `scripts/browser-smoke.mjs`: Chrome DevTools Protocol browser gate at 360/390/1440, Arabic RTL and overflow checks, screenshot artifacts for human review.
- `artifacts/browser-smoke/`: generated screenshots in CI only; not source-controlled.
- `eslint.config.mjs`, `.prettierrc.json`, `apps/web/vitest.config.ts`: lint, formatting and unit test configs.
- `.env.example`: example with **no secrets**.

The real `pnpm-lock.yaml` is committed on this feature branch; frozen install, lint, typecheck, tests, build and HTTP smoke passed at SHA `392bff47` ([Verify 40680982177](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40680982177)). The Chrome browser smoke also passed on exact head `1f312a54` ([Verify 40694813876](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40694813876)); recheck CI on newer commits.

**Future directory proposal — NOT YET CREATED**
- apps/web/: Next.js frontend with mock contracts.
- workers/api/: Cloudflare Worker API gateway.
- workers/ai/: async AI planner.
- workers/state/: Durable Object classes.
- workers/sync/: Queues consumers.
- packages/contracts/: runtime validated DTOs.
- packages/ui/: shared components/tokens.
- packages/quran/: Quran data/player adapters.
- packages/training-engine/: deterministic interactive exercise runner.
- supabase/migrations/: schema changes.

Update this map IN THE SAME PR that creates, removes or moves directories; identify exact responsibilities and entry points, not merely list names.

## CORE-06 #44 — Student portal (M2 preview)
- apps/web/src/app/student/layout.tsx: route-level student shell, persistent across learner subpages.
- apps/web/src/app/student/page.tsx: academic learner overview.
- apps/web/src/app/student/[section]/page.tsx: lessons, mushaf, training, progress, notebook, subscription and account.
- apps/web/src/features/student/index.ts: sole public feature import API for routes.
- apps/web/src/features/student/domain.ts: typed learner, lesson, task and teacher-published report contracts, runtime checks, learner-scope filters.
- apps/web/src/features/student/mock-adapter.ts: isolated invented student fixtures and validated browser-session signup names, not live records or API.
- apps/web/src/features/student/StudentContext.tsx: active learner scoped state; per-learner checkbox state and no cross-learner reports.
- apps/web/src/features/student/StudentShell.tsx: account profile switching, responsive RTL sidebar/mobile navigation, explicit mock warning.
- apps/web/src/features/student/StudentDashboard.tsx: 50/50 academic home, no fake scores on new accounts.
- apps/web/src/features/student/StudentSection.tsx: route-specific detail pages and empty states.
- apps/web/src/features/student/components/{SchedulePanel,WirdPanel}.tsx: 7-day Cairo strip and local practice, respectively.
- apps/web/src/features/student/StudentPortal.module.css: scoped olive/gold/ivory responsive visual system.
- apps/web/src/features/student/student.test.tsx: fixture isolation, grade invariants, empty state tests.
- scripts/browser-smoke.mjs: original landing checks + student portal 360/390/1440 screenshot/interaction checks.
- apps/web/src/features/landing/v3/{LandingDemoProvider,DashboardModal}.tsx: transient same-tab learner profile handoff and portal link; landing stays authentic V3.
All functions are browser-local mock only; no sensitive backend credentials, no real enrollment/booking/teacher/media/payment.
