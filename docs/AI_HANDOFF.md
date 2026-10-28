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

## Quran reader turn regression — Issue #90
- Working branch `fix/90-quran-spread-turn-navigation` (do not push directly to main). Reader previously rendered [2,3] for page 2 **and** page 3, so Next could look broken on desktop. `quranReaderLayout.ts` now provides `getAdjacentReaderPage`; `MadinahReader.tsx` uses it for both swipe and four footer buttons. Page number, surah and ayah jumps remain direct, not spread-normalized.
- Unit regression in `quranReaderLayout.test.ts`; Chrome desktop 1→[2,3]→[4,5]→[2,3]→1 plus tablet 768px single-leaf navigation and screenshot in `scripts/browser-smoke.mjs`.
- **Next:** create linked Draft PR, inspect exact-head CI, fix failures, obtain mobile/tablet/desktop visual review and required human approval. Do not merge/close #90 until acceptance. No Vercel previews, backend/Postgres, R2, Quran asset edits or production deployment.

## 2026-10-28 — next verification: tablet fullscreen Quran (#90 / draft PR #96)
- Added a tablet (<900px) immersive reader mount/resize rule to `apps/web/src/features/student/components/MadinahReader.tsx`, using existing scroll-lock cleanup and compact exit action. Prior 701–899px reader stayed below student shell and could hide its footer.
- Added real 768x900 Chrome viewport, visible page/footer, body scroll-lock and non-scrolling inner stage assertions to `scripts/browser-smoke.mjs`; do not confuse source edits with a passed run.
- **Next exact step:** inspect PR #96 latest HEAD, verify all Verify jobs and browser screenshot at that SHA, correct failures; seek human tablet/keyboard review before merging. Do not change production, R2 or backend.

## 2026-10-29 — #90 tablet CI failure / pending fix
- Draft PR #96 branch `fix/90-quran-spread-turn-navigation`. Last checked head `55461520` failed [Verify 40762650066](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40762650066): code-quality browser tablet `noNestedScroll=false`, while other tablet geometry booleans passed. Governance, lint, TS, unit, build, HTTP and prior browser checks passed; **overall run FAILED**.
- Commits `9fffefa0` (tablet stage-size CSS container and height-aware printed leaf) and `32b6c70b` (extra failure geometry metrics in real Chrome test) are on PR #96. No local browser run was possible in this tool environment. **Inspect exact latest SHA + CI before saying fix works**; do not merge on red, and keep #90 open for physical tablet/RTL visual review and reviewer approval.
- Scope: only CSS and browser smoke in student Quran feature. No backend, Quran source, payments, secrets, Cloudflare/Vercel deployments or data migrations. Rollback: revert the two commits or PR #96; no state migration.

### 2026-10-29 — #90 exact CI and remaining desktop gate
- PR #96: tablet fix succeeded on `c28c17b4` / [Verify 40770633906](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40770633906). Screenshot artifact `12852681274` inspected at 768/390/1440; tablet footer fits, but desktop showed outer student chrome and scrolling.
- New code `20078fd4`: desktop reader immersive on initial route render; `d98a0d24`: Chrome asserts desktop reader top/bottom, footer and body lock. **New head unverified** until its own CI. Keep PR Draft; no merge until checks and human review. Next: inspect newest run and 1440 screenshot, then record outcome in #90. No production deployment.

### 2026-10-29 — latest #90 code verified; documentation recheck
- [Verify 40770979097](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40770979097) SUCCESS at `9a35228c055d16ac0919778f183c5c8b3fd6a808`. Both 768 tablet stage scroll regression and 1440 desktop reader outer chrome fixed. Screenshot artifact `12853175403` inspected for 390/768/1440 reader/footer. PR #96 remains Draft; Issue #90 OPEN pending physical-device UX, keyboard/RTL and required reviewer approval.
- After this documentation-only commit, recheck latest branch SHA/CI. No production deploy, R2 changes, data migrations, backend or paid services.

### 2026-10-29 — intermittent SVG overlay black flash found in real CI
- [Verify 40771300030](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40771300030) FAILED at documentation head `b5a01a92` on physical polygon hit test. Screenshot artifact `12852741690` visually showed opaque black verse regions (CSS race), while earlier `9a35228c` run was green.
- Fix on PR #96: `QuranAyahOverlay.tsx` explicit transparent SVG presentation fallback `a567cedb`; `scripts/browser-smoke.mjs` waits for styled overlay CSS `79cfeec1` before real pointer test. New exact-head CI pending. Never merge until passing and screenshot reviewed; no backend, Quran content or production deployment.

### 2026-10-29 — #90 reader keyboard handoff (PR #96)
- Follow-up on `fix/90-quran-spread-turn-navigation`: reader index/settings/notes/search panel is a nonmodal dialog; opening it now moves keyboard focus to close, and Escape/close restores focus to the prior trigger when still attached.
- `MadinahReader.tsx` owns focus state, `scripts/browser-smoke.mjs` asserts actual Chrome keyboard Enter/Escape and restoration. Source Quran artwork/metadata and other business state unchanged.
- Next exact action: inspect newest PR #96 head, Verify job results and screenshot artifact; fix any failures, then await human physical touch/S Pen/keyboard/RTL review before merge. No deployment or external provisioning.
