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


## 2026-10-28 — native React V3 conversion (branch, pending CI)
- Branch `feat/landing-v3-native-react-interactions` originates at merged PR #64 `fd7b2b6c428d`.
- Replaces injected V3 HTML fragments with JSX in all 14 section components. Classroom tool state, canvas drawing, notes, form/profile flow, mock slots and modal state now use React components/hooks; no standalone runtime interactions script in the route.
- Preserves approved CSS and Arabic RTL visual design. Adds reduced-motion handling and source integrity tests. Demo remains entirely browser-local, not authenticated or booked in a backend.
- Verify code-quality, TypeScript/Next build and 360/390/1440 browser screenshots on this PR's exact head before merge. Further acceptance needed for real auth and accessibility.

## 2026-10-28 — CORE-06 #44, M2 learner portal (branch/CI pending)
- Branch: feat/44-student-portal-m2, based on merged React landing #66 (main 1212d865). Full /student prototype with Home, Lessons, Mushaf, Training, Progress/Reports, Notebook, Subscription and Account routes.
- Learner profile switch in shared header; newcomer gets complete dashboard with empty states, not fictitious instructor/grades; demo-active and trial-booked profiles are explicitly labeled as invented fixtures.
- Dashboard primary panels equal width for 7-day Cairo-local schedule and teacher-approved daily Wird. Three teacher grades (/10) remain independent and null ≠ 0; draft assignments and cross-learner reports are filtered at the data adapter.
- Landing mock registers only in-memory/session demo learner names for the same-tab navigation; NO phone/email, persistent database, real auth/booking/payment/LiveKit, or server records.
- Verification: typecheck, unit, build, HTTP and real Chrome 360/390/1440 screenshots and sibling switching tests required from exact PR head before merge. No production deployment claimed.
- Next: #45 teacher portal mocked UI; #40 Cloudflare runtime spike; #46 Supabase Auth/RLS for real family access after design/security decisions. Issue #43 remains open for real registration.

## 2026-10-28 — CORE-06 #44 continued: student workspaces (branch, CI pending)
- Branch `feat/44-student-portal-workflows` based on merged PR #69 (`105635e`).
- Replaces student route placeholders with independently componentized lesson history/detail filters, pre-submission task drafts, separated academic criteria and report details, lesson notebook and per-learner personal draft notes, Quran fixture highlight/notes/clear, subscription status, and session-only add/remove student profiles.
- The Quran fixture uses the already approved V3 sample, explicitly not an authoritative Quran edition; full licensed canonical text/audio and realtime media are not supplied. No actual homework is submitted, no session joined, no real student records/billing/authorization or media saved.
- Learner-local study notes/assignment drafts are in-memory and explicitly not teacher-approved grades or published reports. Switching sibling profiles keys page-local forms, while the shared provider partitions all local state by learner ID. Phone/email are not recorded to session storage.
- Needs exact-head CI lint/strict TS/unit/Next build/Chrome 360/390/1440 + all 7 routed pages + Mushaf interaction checks; screenshots and accessibility manual review; keep Issue #44 open for integration and final acceptance. M3 auth/RLS remains required before any real data.

## 2026-10-28 — STU-AZ S01 report history correction (PR pending)
- Owner requested complete student frontend A–Z and sequential PRs; see `docs/STUDENT_PORTAL_A_TO_Z.md`.
- Branch: `feat/44-student-az-reports-s01` under #44. Updates `ProgressWorkspace` from unapproved filters/cards to RTL semantic academic table. Adds newest published-per-lesson normalization, page size 5, inline accessible details and honest missing archive.
- Tests: helper and SSR plus appended real Chrome interaction smoke; **CI not yet verified at this point**. No backend, payment, real Quran or deployment changes.
- Next: complete exact-head CI; if passing merge S01, then S02 attendance and 7-day self-service appeals.

## 2026-10-28 — STU-AZ S02 attendance + seven-day appeal preview (PR pending)
- Branch `feat/73-student-attendance-appeals-s02`, Issue #73; builds on merged S01 PR #72 (`6ff52349`).
- `attendance.ts` models teacher-recorded outcomes (present, absent, cancelled, rescheduled, pending), deduplicated latest per lesson, seven-day server timestamp policy, allowed local evidence types/sizes and invented demo sample records.
- `AttendanceWorkspace` is within Student Progress below academic report table: separate four-category counts and detailed RTL register, opened eligible appeal with required written reason and optional file *selection only*.
- There is NO transport/API submission; preview says explicitly not sent, disabled send; expiry shows contact-admin exception text. Never infer a no-show from video attendance.
- Validation requires #73 exact-head CI/Chrome/fixtures. UI review and authorized backend audit pending.

## 2026-10-28 — STU-AZ S03 trial scheduling preview (#76; unmerged)
- Verified preceding S02 PR #74 merged into main at `782f02a1f375a37bf7239b241f1dc6d4524b422c`; S02 #73 remains open for backend integration and visual review.
- Branch `feat/76-student-trial-scheduling-s03` based on post-S02 main. A learner-scoped React trial preview is added to `/student/lessons`; the new-learner dashboard CTA routes to it. Three invented 30-minute slots are **illustrative only** and cannot be booked. No assigned teacher, API, auth, availability, database, payments or real learner data.
- Pure UTC trial policy helper validates slot identity, duration and date, and inclusive T−6h cutoff. Browser-only selected-slot review resets when the learner changes. Unit and real Chrome smoke added; **exact-head CI pending** until PR is opened and run reviewed.
- Backend blockers #46/#47: one-trial entitlement, qualified teacher availability, concurrency/idempotency, real cancellation/reschedule and recurring timetable. Do not merge or close #76 without green exact-head CI, visual review and acceptance; do not deploy.
- Next exact action: inspect PR #76 branch CI (governance, lint, TS, tests, build, HTTP, Chrome 360/390/1440), fix any failures and document exact SHA/run. Main branch ruleset #1 still unverified.
