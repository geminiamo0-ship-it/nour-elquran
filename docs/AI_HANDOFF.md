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
- Prior exact-head CI evidence: `3dbe0cf562248331cfee89298dce6a36b6d5a3cb` / [Verify 40695487092](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40695487092) succeeded **before** this change. **New route boundary assertions passed** on `51fbde724dac1f9a424f210d953986d47e2f983e` / [Verify 40698369854](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40698369854) (all three jobs successful). Any subsequent docs-only commit needs separate verification. Do not merge #60 or #58 without overlap review, main protection #1 and required human review.
- No external provisioning, paid services, secrets, real student data, migrations or deployment.

## 2026-10-28 — CORE-06 learner portal work
- User authorized continuing M2 student portal after merged landing PR #66.
- Current branch feat/44-student-portal-m2. Scoped React feature with 8 student URLs. The design follows approved #3 academic 50/50 schedule-vs-wird arrangement, seven-day strip, separate /10 scores, and no parent dashboard.
- Public route imports only @/features/student; no package or database dependency added. Mock adapter returns only selected learner's teacher-approved tasks and published reports. Explicit demo labels. Signup handoff carries names solely inside browser sessionStorage, never phone/email.
- Before merging: PR referencing #44, inspect CI exact head (lint, TS, unit, production build, HTTP and Chrome test). Inspect screenshots and fix any failing smoke. Update this note with exact checked PR/commit/run, never claim unobserved results.
- No real backend, qualified teachers, Quran canonical source, LiveKit classroom, commercial entitlements, staging or production deployments.
- Next planned PR: #45 teacher portal components, mock permissions and report authoring. M1 #40 Cloudflare adapter spike and M3 #46 Auth/RLS remain separate gates.

## 2026-10-28 — student portal continuing (#44)
- Follow-up on merged PR #69: prior feature had real routes but many text-only placeholder sections. Current branch `feat/44-student-portal-workflows` implements real UI interactions for lesson history, graded reports, private note draft, review-before-send task state, Quran sample marks, account profile add/remove and subscription empty states.
- State is explicitly browser-only. No actual registration/Auth, database RLS, official Quran canonical edition, lesson media, formal teacher approvals, booking, payments, or uploaded student audio. Never describe these UI previews as operational.
- Verify full `code-quality` and governance checks, expanded Chrome smoke, mobile screenshots on the exact PR HEAD; fix failures before merge, record final run/PR SHA and whether visual review was done.
- Next within student portal: real verified Quran source and recorder after licensing/consent, Supabase Auth with guardian verification and RLS (#46), genuine teacher-approved tasks/reports and signed archives; do NOT jump to teacher portal before student UX acceptance.

## 2026-10-28 — CORE-02 #40 non-deploying adapter spike
- Source branch: `feat/40-vinext-compatibility-spike`; linked Issue #40; ADR 0003 status PROPOSED. Prior work #44 merged in PR #70; #68 remains draft and requires human review.
- Added an isolated GitHub Actions vinext 1.3.1 check/init/build and local SSR/RTL/synthetic-cookie probe. This does not modify the existing Next.js application runtime or require Cloudflare credentials.
- **Next exact action:** inspect the new PR head, Verify and Vinext compatibility run logs; fix real errors on this branch; document warnings, output and run URLs in #40. Follow with actual Workers runtime/staging tests only with appropriate approval. Do not claim stack compatibility from local server alone. #1 branch protection still pending owner verification.
