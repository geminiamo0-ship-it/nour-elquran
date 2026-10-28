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

## Student portal M2 continuation — page workflow components
- `apps/web/src/features/student/components/LessonHub.tsx`: scheduled/completed/all filters and expandable lesson detail actions (mock only).
- `apps/web/src/features/student/components/TrainingWorkspace.tsx`: teacher-approved exercise list, note drafting and explicit prepare-for-review state, no actual submission.
- `apps/web/src/features/student/components/ProgressWorkspace.tsx`: approved report timeline/criterion filter with independent memorization/recitation/tajweed grades and meaningful missing data.
- `apps/web/src/features/student/components/NotebookWorkspace.tsx`: selected completed lesson, published teacher summary, local learner-owned notes, no alleged cloud PDF.
- `apps/web/src/features/student/components/MushafWorkspace.tsx`: V3 fixture for verse marks, font-size and temporary notes; not a verified canonical Quran source.
- `apps/web/src/features/student/components/SubscriptionWorkspace.tsx`: bounded state display without fabricated payments/balances/renewal.
- `apps/web/src/features/student/components/AccountWorkspace.tsx`: same-account session demo profile creation, switching and confirmed removal.
- `apps/web/src/features/student/StudentContext.tsx`: per-learner notes, draft task state, verse selection and session profile actions; no server persistence.
- `apps/web/src/features/student/domain.ts`: sanitization and typed learner-local note contract.
- `apps/web/src/features/student/StudentSection.tsx`: route-to-component composition with profile key preventing transient cross-sibling text leaks.
- `apps/web/src/features/student/StudentPortal.module.css`: scoped responsive styles and controls.
- `apps/web/src/features/student/student.test.tsx`, `scripts/browser-smoke.mjs`: seven-route and interaction checks.

## STU-AZ S01 (student report table)
- `docs/STUDENT_PORTAL_A_TO_Z.md`: authoritative step-by-step implementation and delivery gates.
- `apps/web/src/features/student/reportHistory.ts`: approved-only newest-per-lesson stable sorting and five-row increment.
- `apps/web/src/features/student/reportHistory.test.ts`: revision/tie/order/null-grade/table SSR unit assertions.
- `apps/web/src/features/student/components/ProgressWorkspace.tsx`: accessible academic table + one in-row detail; no category filters/charts.
- `apps/web/src/features/student/components/ProgressTable.module.css`: scoped horizontally scrollable mobile academic table.
- `scripts/browser-smoke.mjs`: progress table keyboard-ready elements, expand and sibling isolation Chrome smoke.

## STU-AZ S02 attendance
- `apps/web/src/features/student/attendance.ts`: scoped attendance fixture, current record dedup, count categories, seven-day appeal cutoff, client-side attachment validation.
- `apps/web/src/features/student/attendance.test.ts`: expiry boundary, absence-only policy, updated record isolation and allowed evidence regression tests.
- `apps/web/src/features/student/components/AttendanceWorkspace.tsx`: count cards, RTL attendance table and local-only appeal preview; not a student-to-admin submission.
- `apps/web/src/features/student/components/AttendanceWorkspace.module.css`: mobile/desktop table and appeal form styles.
- `apps/web/src/features/student/components/ProgressWorkspace.tsx`: mounts attendance after independent academic history.
- `scripts/browser-smoke.mjs`: verify demo learner attendance, opening appeal UI, and new sibling's no-record state.

## STU-AZ S03 trial preview (#76; branch only)
- `apps/web/src/features/student/trialScheduling.ts`: pure UTC scheduling hints, 30-minute slot shape, exact six-hour boundary and illustrative slot generator; no booking authority.
- `apps/web/src/features/student/trialScheduling.test.ts`: runtime validation, cross-learner, stale-slot and UTC cutoff tests.
- `apps/web/src/features/student/components/TrialBookingPreview.tsx`: isolated React slot selection/review; deliberately disabled booking and unassigned teacher.
- `apps/web/src/features/student/components/TrialBookingPreview.module.css`: scoped RTL/responsive slot controls.
- `apps/web/src/features/student/components/LessonHub.tsx` and `StudentDashboard.tsx`: composition and CTA routing, not direct infrastructure calls.
- `scripts/browser-smoke.mjs`: three-width real Chrome preview, no-confirmation and sibling isolation regression.
- This is branch-only mock UI, **not** an available trial scheduling service. Backend contract, RLS and transactional reservations remain under #46/#47.
