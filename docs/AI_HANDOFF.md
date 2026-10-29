## #149 — existing development host Quran QA harness (2026-10-29; draft)

- `scripts/noor-quran-qa-target.mjs` strictly limits synthetic browser writes to `https://noor-site-staging.<account>.workers.dev`, requiring `NOOR_QA_RUN_SYNTHETIC=yes`; old password-gated QA hostname is intentionally refused. `tests/quran-qa-target.test.mjs` checks opt-in and hostile/production URLs. The QA browser no longer supplies Basic credentials, and only switches the account form into signup when necessary.
- Owner's change to ordinary Dev is tracked in separate Santoreno PR #241, **not yet assumed merged/deployed**. No real remote QA was run by this patch. Next: verify exact-head Noor CI; once approved developer Worker is actually deployed with canonical D1 and save flag, run synthetic Chrome+API+mobile QA with explicit env, inspect screenshots and D1 ACK, and keep #149 open for failed POST/retry, page-turn-during-load and multi-device tests. Never run against production or real minors.

## #149 — private reader write readiness follow-up (2026-10-29; draft)

- Branch `fix/149-private-reader-hydration-write-guard`: a page-specific readiness function blocks connected pen/marker/erase/note/highlight/bookmark writes until index and active page belong to the selected learner, and blocks new edits after a failed save. This closes the stale-page window between React navigation and its async page-load effect. Demo preview stays editable. New Vitest tests exercise stale page, sibling switch and failure.
- Reader uses `canEditPage(leaf)` both on the ink surface and in `changeInkFor`, and displays an account-specific empty notes message in connected mode. No claim of remote browser QA or durable offline queue. **Verify exact PR head in Actions**, then test protected QA with synthetic identities and page navigation while hydration is pending. Keep #149 and #144 open until remote QA and all gates pass; no production activation.

## Private Quran #144 follow-up — reload of hidden notes/bookmarks (2026-10-29)

- On follow-up PR #146 branch `fix/144-private-mushaf-tombstone-reload`, patched `readPrivateMushaf` to hydrate hidden stable-ID note/highlight/bookmark versions. Previously a hidden item disappeared from visible-only GET and re-adding after refresh produced stale version 0 / 409. The UI now renders only visible bookmarks/highlights while retaining hidden versions for safe restore/edit. Erased pen/marker strokes are not hydrated (new strokes use fresh IDs).
- Updated TS regression and `docs/PRIVATE_QURAN_PERSISTENCE_CONTRACT.md`. No migration or cloud changes. Verify the **latest exact branch SHA** in GitHub Actions; do not reuse prior successful SHA evidence. Keep PR Draft and #144 OPEN pending remote synthetic staging, actual canonical edition import, offline loss policy, capacity and independent privacy review.

## Quran private persistence workstream #144 (source, opt-in)

- [Private Quran contract](PRIVATE_QURAN_PERSISTENCE_CONTRACT.md) documents the new additive `0007_private_mushaf.sql`, owner-bound API `/v1/me/learners/:id/mushaf`, `put/hide/restore` opId/version, private pen/marker/highlight/note/bookmark/position, and build-time double flag OFF.
- **Before considering enabled:** import actual edition manifest+ayah metadata into isolated D1, test real multi-device save/reload/erase/undo/retry, network failure and browser/S Pen. Repo contains only synthetic fixture metadata for *local CI*; user content must never save against fabricated mapping. No student/teacher shared LessonDO yet.
- Current offline queue lives in memory (not durable on tab crash) and query caps 300; must address before broad rollout. Do not call this production deployment or full #142 completion.

## PERSISTENCE HANDOFF — #142 / master inventory (2026-10-29)

- Read [docs/PERSISTENCE_AND_LESSON_RECOVERY_MASTER_PLAN.md](PERSISTENCE_AND_LESSON_RECOVERY_MASTER_PLAN.md) **before** any Quran ink/notes, LessonDO, teacher report, audio homework, Notebook, backup, session or mobile sync implementation. This is a proposed implementation plan, not a new deployed service; owner-approved behaviors retain priority.
- Current reader `MadinahReader` personal notes, strokes and undo/redo are React state; `QuranInk` eraser removes local strokes; `StudentContext` notebook/training drafts remain memory-local, `TeacherContext` reports are mock, `useClassroomPreview` shared drawing is simulated. D1 `personal_annotations` lacks authenticated CRUD, and live LessonDO/report publication/R2 archive do not yet work.
- Strict minimum: verified subject/learner scope, opId + durable ACK, no cross-child leakage, tombstones/undo + correct Quran coordinates/edition, distinction pending/saved/published, author-scoped shared ink, immutable report revisions, outbox recovery, synthetic native Cloudflare staging + restore proof.
- Parent [#142](https://github.com/geminiamo0-ship-it/nour-elquran/issues/142); related #87, #102, #120, #51, #52. Do not confuse docs-only plan with done tasks.

## TEACHER BACKEND B3 #140 — audited staff assignments & 40m booking

- `0006_staff_schedule.sql`: append-only staff scheduling commands and atomic D1 audit triggers for `assign,revoke,book,cancel`. Rechecks roles.manage, active qualified teacher, active owner/learner, full-interval primary assignment, overlap/40m, 6h normal cancellation, and no orphaned upcoming lessons. No room Start/End mutations.
- `src/staff-scheduling.ts` and `auth/routes.ts`: POST `/v1/staff/schedule-actions` behind real Better Auth staff session and current grant, exact allowlisted action DTO and idempotency UUID. Existing teacher roster/timetable and owned learner timetable now have a real staff-only writer.
- SQLite exact-migration tests and native Wrangler local synthetic staff/teacher/account browser/auth smoke. Real staff/teacher provisioning, OTP verification, remote Staging migration/deployment and real student data still intentionally absent. Default preview unchanged; authenticated teacher read UI feature flag OFF.
- Next: verify exact-head CI and only then merge; isolated remote synthetic staging role/assignment/booking UI proof, and follow-up teacher learner plans, last published report and class preparation.

## TEACHER BACKEND B2 #138 — staff-only role provisioning (PR #139)

- D1 migration `0005_teacher_roles.sql`: audited append-only role command ledger with atomic status/qualification transitions using SQLite triggers, actor grant/phone/active account guard and replay constraint. Existing teacher data unchanged.
- New staff-only `POST /v1/staff/teacher-actions`: Better Auth session + unrevoked `roles.manage`, strict JSON, UUID idempotency, server-sourced actor/time. State flow: provision dormant/unqualified → qualify → activate → suspend or revoke qualification. Staff self-promotion forbidden.
- Native Wrangler local synthetic admin/teacher verification added to `scripts/cloudflare-auth-smoke.mjs`. Strict no real OTP/credentials/teacher grants: bootstrap role/phone flags ONLY in disposable synthetic local D1. No cloud staging/production migration, users, real teacher role or frontend activation.
- B3 remains: staff assignment + booking, synthetic staging and real teacher account eligibility, then learner plans/preparation and report/assignments. All CI gates and PR verification required before merge.

## TEACHER BACKEND #136 — initial secured read-only implementation (Draft PR #137)

- Added D1 primary-roster read boundary + protected `GET /v1/teacher/learners`, verified Better Auth qualified teacher only; substitute grants never confer roster access. Exact SQLite migration and Node tests cover future/revoked/expired assignments, archived child, disabled household and query scoping.
- Connected only an opt-in **read-only** Sheikh home/roster/schedule UI using verified API responses and strict client DTO validation. `NEXT_PUBLIC_TEACHER_READONLY_ENABLED=true` AND `NEXT_PUBLIC_ACCOUNT_UI=true` required at build; disabled by default to preserve staging visual demo. No mock fallback in authorized mode; report/homework/plan pages explicitly unconnected.
- NOT done: actual Sheikh account provisioning, lesson brief or academic profile API, report publication, real class/LiveKit, live D1 migration or real child records. Do not deploy production or enable real accounts; exact-head Verify and review required.
- Next: inspect CI, stage with SYNTHETIC D1-qualified teachers after controlled provisioning; implement academic plan/report contracts and subsequent LessonDO handshake in focused follow-ups. See #45/#120.

## Classroom #120 — lifecycle shortcut hardening (2026-10-29, draft PR #121)
- On `feat/noor-classroom-40m-booking-guard`, D1 `0003_teacher_schedule.sql` now rejects direct live/completed inserts, scheduled-to-completed skips, and cancelled-to-live/completed shortcuts. Preserve historical rows and normal reactivation; tests use the full scheduled/live/completed path.
- This is **not** an authenticated Start/End API. DO-backed simultaneous teacher+learner presence, verified acting teacher, durable operation idempotency, ended-at audit and media remain unimplemented. Never expose direct status updates to clients.
- Check exact-head Verify for this commit, record SHA/run in #120/PR #121; leave PR Draft and unmerged. No cloud migration, production deployment or child data.

## CLASSROOM #120 / PR #121 — terminal-state guard handoff (2026-10-29)
- On `feat/noor-classroom-40m-booking-guard`, draft migration `0003_teacher_schedule.sql` now denies `live -> scheduled/cancelled` and `completed -> any other status`. Existing single-live guards cannot be bypassed by simply reopening a live booking. Three new synthetic SQLite regression tests are in `workers/api/tests/test_teacher_calendar.py`.
- This is only D1 relational integrity; direct SQL `scheduled -> live` remains possible for trusted backend code. **No teacher authentication, both-party presence, Start/End endpoint, durable idempotency or media was implemented.** Never expose status updates directly to a client.
- Check newest PR #121 exact-head Verify, then record SHA/run in #120 and PR. PR stays Draft pending review. No remote migration or deployment. #1 branch protection remains unverified (GitHub app 403); owner must enable/verify protection in repository settings, without changing PUBLIC visibility.

## CLASSROOM #120 / PR #121 — concurrent live-room guard (2026-10-29)
- Draft branch `feat/noor-classroom-40m-booking-guard`: two additional D1/SQLite triggers in `workers/api/migrations/0003_teacher_schedule.sql` deny an INSERT/UPDATE producing a second `live` lesson for the same teacher OR learner. Adjacent reserved 40-minute slots remain bookable; an overrun does not auto-end the first lesson. Four synthetic tests added to `workers/api/tests/test_teacher_calendar.py`.
- Review exact-head GitHub Verify before claiming tests pass. No authorized Start/End endpoint, teacher presence or learner presence is implemented; a direct SQL status write is not actor authorization. Leave PR #121 Draft, no remote migration/deploy, no real child records.
- Next exact engineering step: authenticated teacher-only lifecycle with durable simultaneous two-party presence, atomic checks and idempotent Start/End. Reconcile provider ADR conflict before A/V coding. Owner's main-branch protection decision #1 remains unverified due GitHub integration 403 on the protection endpoint; do not claim enabled.

## CLASSROOM #120 / PR #121 — historical teacher integrity (2026-10-29, draft only)
- CI exposed an incorrect assumption in an initial test: `0001_core.sql` already makes `lessons.learner_id` immutable, so reassignment is prohibited even for active learners. Corrected the test and removed the redundant proposed eligibility trigger change.
- Added `lessons_teacher_immutable_after_start` to draft `0003_teacher_schedule.sql`: the acting teacher may change while scheduled, but cannot be silently rewritten when the lesson is live or completed. Two SQLite regressions cover immutable learner identity and teacher identity across scheduled/live/completed.
- These are database integrity rules, **not** role authorization, presence verification, Start/End APIs or live-room lifecycle enforcement. No remote D1 migration, staging/production deployment, or real learner data. New exact-head CI pending; PR remains Draft.
- Next: check CI; review teacher/substitute lifecycle with #120 before merge, then implement authenticated teacher-only Start/End with verified simultaneous presence and idempotency.

## CLASSROOM #120 / PR #121 — booking eligibility follow-up (2026-10-29, branch only)
- Continue draft PR #121 on `feat/noor-classroom-40m-booking-guard`: `0003_teacher_schedule.sql` adds active learner + active owner account guards to new/reactivated scheduled lessons and rechecks teacher/learner/owner when rescheduling. `test_teacher_calendar.py` adds four synthetic SQLite cases for archive, disable, reactivation, reschedule and preserved history.
- Not an authenticated classroom endpoint, two-person presence check, teacher-only Start/End, production D1 migration or deployment. No real children or provider secrets.
- Inspect newest exact-head Verify jobs before merge. Next engineering slice in #120: role-authenticated Start/End only after durable presence of BOTH teacher and learner; require atomic recheck, idempotent operations and explicit teacher End. Reconcile conflicting media provider text in #120 against accepted ADR 0004 before any media implementation.

# AI agent handoff contract

## OPEN DEV STAGING #118 — current implementation
- Branch `feat/118-public-preview` adds `NOOR_DEV_OPEN=true` developer routing to `workers/site/src/staging-access.ts` and tests. The extra staging-wide Basic password is disabled on all routes, but account APIs still require their normal application sessions and per-owner authorization.
- Before rollout, edit Santoreno `.github/workflows/noor-private-staging.yml` and `scripts/noor_private_staging.py` to serve `NEXT_PUBLIC_ACCOUNT_UI=true` developer account UI and verify the site/real assets, anonymous app-level 401 and synthetic account registration. No real student data/OTP. **Do not call it public until postmerge remote checks pass.**

## STAGING #114 — VERIFIED on Cloudflare (2026-10-29)
- Latest Noor main `dff83b382b3774a7476ae8dee64b7454fd09859c` includes merged #113 same-origin account UI and #115 staging-only fail-closed access gate; Noor main [Verify 40808432004](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40808432004) SUCCESS.
- Dedicated remote private staging `noor-core-staging` D1 and `noor-site-staging` Worker are deployed via `geminiamo0-ship-it/santoreno` isolated workflow. Confirmed [real remote run 40810303172](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40810303172) SUCCESS. See [runbook](NOOR_STAGING_RUNBOOK.md).
- Remote synthetic QA verified all-site Basic gate (401 unauthenticated), gated /health,/ready, signup, persistent owner profiles, two learner siblings, cookie reload, cross-account denial and logout replay. Private random staging password is intentionally not in GitHub logs; a known authorized secret or Cloudflare Access must be configured before human browser QA.
- Keep OTP phone/email/WhatsApp deferred, allow only synthetic identities; no real users. Backend/Cloudflare staging is proven, but **not** lesson notebooks, teacher/student real records, bookings, payment, child-only logins, remote browser visual QA or D1 disaster recovery rehearsal. Resume #102 and #46/#56 as separately scoped changes.


## Historical AUTH-02 #112 — former branch continuation (merged PR #113)
- Read main #111 acceptance: merge `14e73efde6e406dff34603ef053b2f17e789984c`, all four postmerge Verify jobs in 40803047786 SUCCESS. #43/#46 remain open.
- Branch `feat/112-account-ui` connects account UI to maintained backend contracts behind default-OFF NEXT_PUBLIC_ACCOUNT_UI. AccountProvider verifies session in D1, loads only owner profiles, guards stale async results and clears private views on logout/error/401. Connected StudentProvider has empty learning data and never reads demo storage/fixtures.
- Root `workers/site` routes same-origin API to existing API handler and retains ASSETS behavior. Backend enablement/secret/D1 are independent of public UI flag; no real bindings/resources created. Local native Chrome fault-injection tests plus existing four-job Verify must pass before merge. Record exact head/run in #112/PR after CI, then verify main.
- Next after this slice: #46 phone ownership/recovery and real-user rollout prerequisites, explicit child/staff authorization and cloud staging/backup; learning APIs remain separate. No messages or deployment claimed.

## AUTH-01 #110 / PR #111 — current continuation
- #109 merged as `a8ea58cdc76c25ad89ff02bb1e280bd3b90559e4`; postmerge Verify 40800758113 succeeded. Earlier entries below are historical.
- AUTH-01 code head `e1fd72e68a786d7c41497d124b3c91cc332fce5b` passed **all four jobs** in [Verify 40802629650](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40802629650): strict types, unit/build/Chrome and native local auth/session/ownership/rate-limit/logout/disabled/expired acceptance. 26 Node + 22 SQLite backend tests; maintained Better Auth + Drizzle, additive 0002, default-disabled same-origin wrappers. See workers/api/README.md and ADR 0005.
- Final docs and explicit session DTO assertions were added after that verified head. Recheck newest PR head and all four jobs, record evidence in #110/PR, then merge and inspect main. Do not infer newer CI from older green runs.
- No remote provision/deploy, real users or phone messages. Keep #46 OPEN for frontend session UX, delivery-backed verification/recovery, pre-registration abuse prevention, restricted-child and staff flows, cloud staging and restore rehearsal. A password does not verify phone ownership. Raw internal auth endpoints must remain unreachable.
- Next exact implementation after this PR: existing signup/profile UI integration in its own linked issue, preserving demo disclosure and default-off deployment until rollout prerequisites pass.

## Current continuation — #46 native local D1 gate (2026-10-29, branch-only)
- Main baseline `dc3da3e041c57e9e6af8734fc2bb323885f9be60`, merged #108; #104 closed, #46 open. This branch introduces `scripts/cloudflare-local-smoke.sh` and a separate `cloudflare-local-d1` Verify job.
- Disposable local Wrangler 4.45.0 only: apply migration twice, run real Worker with same local D1 persistence, probe /health, /ready, /v1 and forged identity. Never use --remote or deploy. PR #109 code head `c098fad5476ee276e17887e3a32c8cdca4f52fb9` passed all four jobs in [Verify 40795971889](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40795971889), including native local D1 migration replay and Worker HTTP. This is **local only**, not cloud staging; recheck the newest docs-only commit's exact-head CI before merge.
- This does NOT implement auth, provision D1, run remote migrations or accept real child records. Next: resolve native CI errors if any; integrate maintained Workers-hosted auth and verified learner ownership in #46, while #102 remains an independent frontend-only task.


Current integration baseline: main `df284bcf00e81b6199067d6d9386eb2e10a35997` (merged #105 static Next.js export/Workers assets fix). CF-01 preserves those files. Draft #107 overlaps the foundation and is consolidated in #108 with one migration lineage and the revised #103 plan.

## Latest handoff — CF-01 #104, 2026-10-29 Cairo
- Read ADR 0004 and current PROJECT_STATUS. Owner approved Cloudflare-only infrastructure; older Supabase/Postgres/RLS/LiveKit instructions below are superseded. No parent dashboard or Quran/learning-policy change.
- CF-01: local Worker foundation + strict D1 core migration + pure authorization helpers + 18 Node / 19 SQLite tests. /v1/* fails closed until auth exists; no data endpoint or real login supplied.
- Native D1/DO/Worker behavior and remote resources are NOT verified. No production SQL, real learner data, secret copying, backup job, deployment or media/provider messages.
- Next: #46 maintained Workers-hosted auth + D1 session persistence + real staging bindings and native authorization tests, then notebook API integration/#102 and report publishing. First-report deadline/child write-sharing policy remain unresolved at their relevant stage.
- Use CLOUDFLARE_BACKUP_AND_RESTORE.md: 30d Paid/7d Free Time Travel, longer private exports, R2/DO scope and reconciliation; no destructive restore authorized by architecture adoption.
- Record exact-head Verify and PR/merge evidence in #104. Preserve old checkpoint evidence only as history; Vercel previews remain disabled.

## Previous handoffs (historical)



## Latest handoff — 2026-10-29 Cairo, #101 planning
- Baseline: main `906a993d0ea350591692045fa878da34995d7c1c`, merged Training PR #100. Notebook is still a local selector/summary/note form.
- Read [the complete Arabic plan](LESSON_NOTEBOOK_AND_BACKEND_READINESS_PLAN.md). This branch consolidates approved product decisions and proposes contracts/RLS/publication/storage/recovery/delivery tests. No backend, migrations, uploads, messages or deployment.
- Next exact action: [#102](https://github.com/geminiamo0-ship-it/nour-elquran/issues/102), notebook UI/contracts on shared reader with last published layer, separate private layer, honest share/export states and L1/L2 + learner-switch tests. Backend then starts B0/B1 under #46 before real records.
- Preserve canonical Mushaf per learner, latest published report only, private notes by default, explicit sharing/submission and substitute brief expiry at lesson end; limited report correction must not restore summary access.
- Resolve provider/login, child-session powers, retention/revocation and billing edge cases at their stated dependency stages; proposals are not shipped or previously approved facts.
- Inspect this PR exact-head Verify and record SHA/run URL in #101/PR. Older evidence below belongs to its named commits. Keep Vercel previews disabled.

## Historical handoffs

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

## Student Portal A–Z S01 current handoff (2026-10-28)
- Start main: `cee86d70`. User approved 16-step student-only scope, written to `docs/STUDENT_PORTAL_A_TO_Z.md`.
- Current S01 branch: `feat/44-student-az-reports-s01` refs #44; table uses latest published report per lesson and five-row pagination with inline details, null scores distinct from zero, no report filters/charts.
- Before merge inspect EXACT branch head Actions: repository policy, governance, lint/typecheck, unit, Next build, HTTP and Chrome at 360/390/1440 incl. academic report interaction. Fix failures and rerun; record run in status. Screenshots still need manual visual acceptance.
- Next strictly S02 attendance register+7day appeals, but only after S01 CI/merge. Real identity, media, booking and payments remain unavailable.

## 2026-10-28 — Student step S02 in progress
- S01 merged PR #72, main `6ff52349885a1ee0c914aa9b420ff8ba640dc968`. A–Z roadmap is `docs/STUDENT_PORTAL_A_TO_Z.md`.
- Issue #73/branch `feat/73-student-attendance-appeals-s02`: attendance outcomes + counters + detailed register and 7-day appeal UI, required written reason, optional local evidence selection. No actual upload, no admin submission or attendance verdict; all example fixtures labeled.
- Inspect latest branch exact SHA; lint/TS/units/build/HTTP/Chrome gates including learner separation and appeal. Then PR and merge if passing.
- Next S03 trial booking frontend; do not create fictional successful bookings. True billing/auth/attendance backend not yet operational.

## 2026-10-28 — S03 trial preference work (frontend only)
- S02 merged PR #74 at `782f02a1f375a37bf7239b241f1dc6d4524b422c`; verify run 40725212828 success (31 tests + Chrome).
- Current Issue #75 S03 branch `feat/75-student-trial-scheduling-s03`: scoped mock preference selector for free 30-minute trial and weekly recurring patterns; no actual availability, teacher identity, payment, bookings or API.
- Before merge inspect latest commit SHA and CI for lint, TS, tests, Next build, HTTP/Chrome. S01 and S02 regression tests must stay green.
- After S03, S04 Quran reader source/edition rights decision and verified canonical mapping; do not generate Quran source content without rights verification.

## S04 Quran reader handoff (2026-10-28)
- Latest merged S03 main `29065fdb860abc7eb254c584fe7591d791559c48`; S04 work on `feat/79-real-quran-reader-r2` refs #79. No shipped/deployed Quran content claimed without exact-head CI and R2 live checks.
- Source: official King Fahd Complex page artwork, via Quran.ws versioned `hafs-kfqc/v1.1.1` 604 SVG pages and per-page ayah polygons; per-ayah Uthmani Hafs text via Quran JSON static chapters. Never generate or edit original Arabic text.
- In `santoreno`, PR #216 adds automation to create bucket `noor-quran-hafs-v1`, fetch 1323 files, publish manifest last and deploy isolated read-only Worker. Wait for its actual GitHub Actions pass; may block on missing Cloudflare secrets/access/asset mirror.
- S04 acceptance: CI Verify, manual compare sample pages (including 1 and 604) to authoritative source, confirm 6236 verse identifiers before claiming global ayah mapping. Word highlights, pens, private persisted notes and licensed audio remain later phases.

## Handoff — Quran UX #85
- Branch `feat/85-quran-smooth-reader-notes-search` from `e413cf9d34532cdae847b4c1bebc34665f50eddc`, issue #85. Verify PR CI and mobile visuals before merging.
- Preview Deployments temporarily disabled for `nour-elquran`, `nour-elquran-422`, `nour-elquran-422o` to prevent exhausting Hobby builds. Production auto deployment unchanged.
- Quran assets prefer isolated Cloudflare worker; pinned GitHub source fallback. Real Cloudflare upload state requires Santo #215 verification.
- Teacher notes publication, cross-device personal notes, classroom real-time annotations, tafsir and voice playback are not live; no teacher account/auth/RLS backend. This PR implements frontend interactions and typed note authorization boundary only.

## 2026-10-28 — Quran P0 #88 physical touch regression hardening (PR #89, unmerged)
- The existing browser smoke simulated `Element.click()` on a printed ayah path, which could pass even if the polygon was clipped, covered or pointer-disabled. Replaced it with viewport hit-testing via `document.elementFromPoint` and actual Chrome DevTools `Input.dispatchMouseEvent` press/release; the test then requires the note editor to open. This is a stronger browser interaction gate, not yet proof of human touch-device usability.
- Changed `scripts/browser-smoke.mjs` on `fix/88-quran-reader-mobile-interaction`, commit `6fe1890782c493850c10b664a32e93cae4df7e6b`. Existing P0 unit/Chrome and responsive tests remain. Check the exact latest PR head GitHub Actions after subsequent documentation commits; do not merge until green and required review.
- No changes to scripture, secrets, production, R2, payments or student records. Notes remain session-local. Next: inspect real pointer-test CI and 390px screenshots, correct any clipping/hit failures, then request human mobile visual review.

## Reader shell approved, issue #90
- Branch `feat/90-quran-reader-shell-reference-ux` based on `ad691b59`: modular `ReaderPrintedPage` and pure `quranReaderLayout` layout tests, new responsive app shell at `/student/mushaf`, no dashboard card chrome, desktop two-page spread and mobile one-page. Source polygons per printed page preserved. Index, bookmarks, settings, source search and temporary notes; no user/backend or audio/tafsir transport.
- Verify exact-head CI, Chrome and screenshots before merge; do not claim deployed until Vercel production commit confirmed. Preserve low Vercel deployment quota by keeping Preview Deployments off.

## Current handoff — Quran reciters #92
- New `quranReciters.ts` metadata-only source and pure verse queue builder; `components/QuranRecitationPlayer.tsx` + CSS compact media dock. `MadinahReader` toolbar includes a Tilaawa icon and printed/ayah notes have 'Listen to this verse' action. Reader highlights the current verse while listening (not a fabricated word sync).
- Audio streams third-party EveryAyah directly; source metadata MIT does not license original media. Do not mirror 6,236 files to R2 or enable offline storage until licensed. For future official audio use King Fahd Complex five Hafs reciters listed at https://qurancomplex.gov.sa/quran-audios/ with explicit site/app permission and pinned archive checksums.
- No DB/backend per owner; all profile notes and playback state in local React only. Test and merge one PR, no repeated Vercel previews.

## Quran compact UX handoff (#94)
- Branch `fix/94-quran-page-first-compact-toolbar-audio`. Main parent `6cc73b242cf3552ee78d41f0411c3fc0cecc44a5`; PR only after exact-head green CI.
- `QuranRecitationPlayer.tsx` settings live in optional accessible `aria-expanded` controls; reciter/scope/repeat/speed/scrub DOM retained and a tiny time-progress track remains on compact bar. No layout jumping on expand/collapse.
- `MadinahReader.module.css` removes prior forced audio-open `100dvh - 270px` leaf width clamp, minimizes vertical bars while preserving targets. `MadinahReader.tsx` collapses toolbar meaningfully, starts mobile with compact one-row icons visible.
- No PostgreSQL or persistent notes; owner explicitly requires one backend phase at end. Verify 375x667 screenshot, 360/390/1440 existing smoke, 53+ unit tests, no manual Vercel preview/build.

## Quran interaction handoff, 2026-10-29 (#97)
- Root cause on Android: `QuranInk.begin` rejected `pointerType==='touch'`, active overlay had `touch-action:pan-y` and no transparent capture rect; so finger did not paint and page scrolling captured gestures. New behavior in draw mode: touch-action none, SVG backdrop captures pointer and pointer capture follows movement; passive mode allows swipe. Pointer cancel drops draft.
- `QuranAyahOverlay`: first click selects (same polygon geometry); second rapid click of same key opens editor through `onOpenNote`. Keyboard remains direct editor access. `quranInteraction.ts` controls 450ms window by verse/word key. On-page reader adds vertical palette popover without shifting viewer. `SmoothMadinahPage` art keyed by shown.page adds short animation after decoded swap; reduced motion disables.
- DO NOT build Postgres now. Contract `docs/QURAN_CANONICAL_MUSHAF_AND_LESSON_VIEWS.md`: one learner master Mushaf annotation graph, teacher published additive layered notes; lesson notebook filtered same viewer only, immutable versioned source. No backend storage is operational yet.
- Exact-head CI should test 56+ Vitest unit cases, browser real pointer one tap/second tap and CDP finger stroke 390px, screenshots, page geometry and 360/390/1440 smoke. Branch preview deployments remain disabled.

## Handoff — Training #99 (frontend-only)
- Issue #99, branch `feat/99-student-training-workspace`. `TrainingWorkspace.tsx` new three-tab accessible nav: Homework, Self practice, Next lesson readiness. `TrainingQuranSession.tsx` shares printed Madinah viewer with only verified assignment surah/ayah scope, uses source text to hide/reveal and includes reciter for selected ayah; `TrainingVoicePractice.tsx` optional local microphone recording with no upload. `quranAssignment.ts` typed structured references, validated and tests.
- Home dashboard `WirdPanel` remains summary. Notebook remains its own archive UI. Preserve text `لا توجد تكليفات معتمدة` for new learner and no fake deadlines. Mock tasks clearly identified as demo; no production submission. Auth/RLS and sync deferred.
- Verify lint, TS, Vitest, Next production build, Chrome 390px + 1440px via GitHub CI before merge. No Vercel Preview Deployments due daily limit.



## Classroom eligibility continuation — PR #121 (2026-10-29)
- Issue #120: booking guard must deny an inactive/unqualified acting teacher for **new scheduled** reservations, status reactivation and reassignment. Added SQL triggers in `0003_teacher_schedule.sql` and three SQLite regressions in `test_teacher_calendar.py`. Do not treat this as authorization for teacher Start/End, presence, media or a verified teacher assignment; those are later use cases.
- Code/test commit `f957c31f0e425b44b93cd28e86e4267ec859cee0`. Recheck latest HEAD CI after docs and record exact SHA and workflow results in #120/PR #121; leave Draft until review. No cloud D1 migration, child data, payment or production deploy.

## Handoff — Classroom calendar SQL-first PR #121 (2026-10-29)

Plan: #120 and parent roadmap #38. Branch `feat/noor-classroom-40m-booking-guard`; draft PR #121. New files: `workers/api/migrations/0003_teacher_schedule.sql` and `workers/api/tests/test_teacher_calendar.py`. New bookings must occupy exactly 40 minutes; reject overlapping teacher or learner intervals transactionally, both on new insert and changes; canceled bookings free capacity and historical 30-minute rows are not rewritten. Keep 30m as prior instructional target; timing does NOT close a room. Existing `lessons` and `noor_schema_meta.core=1` remain. Review CI/local D1 migrations BEFORE merge, no remote/staging production mutation. After this slice, implement verified teacher/student waiting room and explicit teacher Start/End with atomic state and DO replay. Audio/video provider decision remains conflicting: ADR 0004 RealtimeKit vs owner-discussed LiveKit Cloud; resolve in a dedicated ADR update BEFORE media coding. No secrets in repo or chat.


## Handoff — Classroom lifecycle contract & audit PR (#120)

Branch `feat/noor-classroom-lifecycle-contract`. `workers/api/src/classroom/lifecycle.ts` has pure verified teacher-only Start/End decisions requiring two authenticated connected room members for Start. Its presence parameter MUST come from authorized Worker and LessonDO, not client JSON; this PR doesn't create an HTTP endpoint. `0004_classroom_lifecycle.sql` adds immutable, actor-scoped D1 event ledger (one start and one end per lesson), without timers or changing previous rows. Node and Python tests cover guards/restore; run root exact-head CI including Cloudflare-local migrations. **Next actual implementation**: DO websocket membership plus Worker verified teacher/learner identities, safe atomic conditional status+audit, and correct media room provider after ADR reconciliation. No self-start, auto-end or claimed classroom deployment.


## Handoff — Verified session teacher + learner timetable read endpoints (#120)

Branch `feat/noor-authorized-lesson-calendar-api`. New `workers/api/src/lesson-calendar.ts` defines bounded, permission-constrained D1 selects. In `workers/api/src/auth/routes.ts` the teacher path `GET /v1/teacher/lessons` checks the BetterAuth verified session and resolves a qualified, active teacher by server-side auth subject BEFORE calling `ownerAccount`. Learner route `GET /v1/me/learners/:id/lessons` validates owner profile with getOwnedLearner and SQL accountId filter. Python test reads and executes actual TS SQL against new D1 migration schema. This does NOT prove active teacher provisioning/auth in deployed staging yet; native integration next. Do not treat listing permission as permission to Start or End, which requires real DO two-person presence and explicit teacher action.


## Handoff — Sheikh portal React implementation #45 (2026-10-29)

Branch `feat/teacher-portal-full-ux-126`. Owner says Sheikh portal all agreed details first, classroom next. Public React feature index at `features/teacher/index.ts`, three thin Next routes `/teacher` and static `/teacher/[section]`, eight sections covering #11–#19. `TeacherProvider` is deliberately DEMO and scoped to synthetic learner IDs; don't mistake local buttons for authoritative backend changes. All live class/audio buttons disabled. `TeacherPortal.module.css` responsive RTL follows current branded student theme; use component boundaries, no HTML blobs or duplicate Quran. `domain.ts` encodes grades nullable /10, student-first/teacher-first start presence, >=15 late student no-show option, >=10 late teacher alert, 40m overtime warn (never auto end), substitute plan restriction and Quran range validation. `docs/TEACHER_PORTAL_BACKEND_CONTRACT.md` maps UI screens -> proposed D1/DO/Worker APIs and error states; carefully follow its authorization gate before connecting real accounts. `teacher.test.tsx` and Chrome browser smoke need exact-head green. Do not fabricate teacher account access or provision LiveKit secrets in frontend. Next start classroom UI only after teacher frontend suite accepted, then connect two-client real LiveKit and LessonDO.


## Handoff — Quran-first interactive classroom preview, planned PR #127 (2026-10-29)

Use branch `feat/classroom-interactive-preview-127`; parent #50/#120 and completed Sheikh PR #126. New Next `/classroom` through public `features/classroom/index.ts`. Canonical Quran `ReaderPrintedPage` is reused/exported by `features/student/index.ts` so no asset clone. `ClassroomPreview` wraps `ClassroomControls`, `ClassroomMedia`, `ClassroomSidePanel`, and local `useClassroomPreview`/policy `domain.ts`; CSS responsive RTL. Teacher/stud role selector and simulated attendee checkboxes are for DEMO ONLY; do not trust them in any real endpoint. Teacher-only Start when both present, teacher-only End even >40min, Quran navigation only by teacher, hybrid drawing permission/teacher hides shared ink, student own mic activation only, author-aware local audit, independent grades and per-ayah errors. Floating video and local self-preview hiding do NOT use real media yet. `docs/CLASSROOM_UI_BACKEND_CONTRACT.md` is the authoritative UI→Worker/DO/LiveKit/replay/security task map. Run exact-head GitHub Verify and inspect Chrome screenshot/interaction before merging. Next build real authorized classroom per-lesson DO and session-scope LiveKit without exposing secrets; no automatic A/V recording.


## Handoff — classroom per-lesson access API scaffold (#50)

Branch `feat/classroom-session-access-130` extends the merged classroom preview PR #129. `workers/api/src/classroom-access.ts` returns *read-only* minimum scheduled/live classroom appointment only for a verified teacher role with valid primary/accepted substitute grant, or an owner-authenticated learner whose lesson+account matches. `workers/api/src/auth/routes.ts` uses `auth.api.getSession` subject; no client-asserted role and no LiveKit secrets. Deny missing/unverified/disabled/archived/revoked/terminal cases. All 200 responses say `roomConnected:false`. `test_classroom_access.py` runs exact TS SQL against all D1 migrations. Next PR must implement actual LessonDO authenticated WS presence/reconnect and teacher-only Start/End, then secure LiveKit Cloud per-role tokens. Do not misrepresent access check as successful join.


## Handoff — no-scroll classroom and immersive session mode (#50)

Branch `feat/classroom-focus-fullscreen-mobile-priority`. User screenshot revealed tall page requiring scrolling. `ClassroomPreview.tsx` adds fullscreen-capable `وضع الحصة`, collapsible teacher tools/notes and role-dependent layout attributes. `Classroom.module.css` overrides legacy outer-page scroll with contained `100dvh` shell and original Quran sheet ratio. On a phone, learner remote Sheikh video is always above the Quran; optional tools never replace either. Teacher corrections/grades panel is an optional drawer on phones and independently scrolling on desktop. `scripts/browser-smoke.mjs` now asserts screen fit, teacher video priority, visible Quran sheet and immersive mode. The browser-mode button is NOT lesson Start/End, and all role/media inputs remain synthetic; there is no LiveKit or real Quran cross-client syncing. Wait for exact-head green CI and isolated staging deploy, then owner QA. Keep accessibility focus and narrow landscape in next visual pass.

## Handoff — final approved compact teacher/student classroom UX

Owner approved desktop + mobile classroom concept ("ممتاز نعتمد"). Source-of-truth: `docs/CLASSROOM_APPROVED_DENSE_LAYOUT.md`; parent #50/#120. Branch `feat/classroom-approved-dense-layout` is a focused *UI-only* refactor of the already merged no-scroll/fullscreen Quran-first classroom. Keep the real `ReaderPrintedPage` (604 verified pages) and role rules, ignore fictional text/counts in a generative visual mockup. Teacher desktop: combine header/presence/demo clock into thin bands, compact toolbar, central Quran, useful camera panels and direct correction/grade/notes. Student mobile: Sheikh camera above Quran and minimal tools. New teacher-side arrow buttons honor page 1..604 bounds. Remember that QA role/presence controls are mock only and the signing/auth/DO+LiveKit runtime is not connected. Run exact-head CI and browser 360/390/768/1440, then isolated staging before calling the implementation deployed.


## Handoff — fix classroom tiny Quran + wasted space from real screenshots

Owner reported final compact design #132 still looked unchanged in live staged desktop/phone screenshots. Root cause: multiple CSS override layers and generic Quran mobile max width `(100dvh - 140px)` compounded by classroom height sizing, while browser CI checked containment not area utilization. Branch `fix/classroom-real-viewport-layout` refactors CSS, adds opt-in `viewportFit` to canonical Quran renderer with 100cqh container sizing ONLY in classroom, keeps sheet 345:550, removes waiting overlay, student desktop empty column, and adds physical-size regression tests for 360x667 and 1280x900. Keep this focused on actual usability and do not declare done on mere Next static build; require screenshot/physical size CI and isolated staging re-deploy. Real A/V, LessonDO and teacher enrollment are not in this scope.
