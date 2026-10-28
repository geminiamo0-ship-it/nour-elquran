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

## In-progress stacked UI slice (#41, PR #61)
- `apps/web/src/shared/ui/Button.tsx` and `Button.module.css`: native accessible button, approved gold/olive variants, reduced-motion behavior.
- `apps/web/src/shared/ui/Card.tsx` and `Card.module.css`: semantic, responsive paper card primitive.
- `apps/web/src/shared/ui/Field.tsx` and `Field.module.css`: labeled native input with hints, required and error semantics.
- `apps/web/src/shared/ui/index.ts`: public exports; `Button.test.tsx` and `Field.test.tsx`: server-rendered markup unit checks.
- This section describes **unmerged draft PR work** based on #39; no claim that `main` contains these paths.

- `apps/web/src/shared/ui/Alert.tsx` and `Alert.module.css`: status/error messaging with accessible live-region roles.
- `apps/web/src/shared/ui/EmptyState.tsx` and `EmptyState.module.css`: semantic empty-state with optional action.
- `apps/web/src/shared/ui/Alert.test.tsx`: feedback and empty-state SSR tests.
