## CLASSROOM #120 / PR #121 — historical teacher integrity (2026-10-29, draft only)
- CI exposed an incorrect assumption in an initial test: `0001_core.sql` already makes `lessons.learner_id` immutable, so reassignment is prohibited even for active learners. Corrected the test and removed the redundant proposed eligibility trigger change.
- Added `lessons_teacher_immutable_after_start` to draft `0003_teacher_schedule.sql`: the acting teacher may change while scheduled, but cannot be silently rewritten when the lesson is live or completed. Two SQLite regressions cover immutable learner identity and teacher identity across scheduled/live/completed.
- These are database integrity rules, **not** role authorization, presence verification, Start/End APIs or live-room lifecycle enforcement. No remote D1 migration, staging/production deployment, or real learner data. New exact-head CI pending; PR remains Draft.
- Next: check CI; review teacher/substitute lifecycle with #120 before merge, then implement authenticated teacher-only Start/End with verified simultaneous presence and idempotency.

## CLASSROOM #120 / PR #121 — booking eligibility continuation (branch only, 2026-10-29)
- Additive draft D1 migration `0003_teacher_schedule.sql` now rejects new/reactivated scheduled bookings when learner is archived or owning account disabled, and rechecks learner, owner and teacher eligibility on schedule changes. Existing completed history remains intact. Four synthetic SQLite regression cases added to `test_teacher_calendar.py`.
- This is a database integrity guard, **not** authenticated booking/start/end or verified waiting-room presence. No remote D1 migration, deployment, child data or payment action. Exact-head GitHub Verify must be inspected before treating the branch as tested; PR #121 remains draft.
- Next: verify PR #121 exact-head CI and human review; then design separate authenticated teacher-only Start/End with two-party presence and idempotency in #120, without inferring presence from lesson status.

# PROJECT_STATUS — verified handoff state

## OPEN DEV STAGING #118 — implementation branch (not yet deployed)
- Owner requested open, passwordless preview of the existing `noor-site-staging` site. Site Worker offers `NOOR_DEV_OPEN=true` specifically for the developer staging Worker: no extra Basic password for pages or API. Normal Better Auth password/session and owner-level learner authorization remain enforced.
- Companion Santoreno provisioning workflow must build `NEXT_PUBLIC_ACCOUNT_UI=true` (account-enabled developer UI), configure open-dev flag and verify real Cloudflare 200 pages/assets, app-level anonymous 401, synthetic registration/session/ownership smoke. **No remote public rollout verified yet.**
- Existing account data and D1 stay private. Public phone registration is prohibited until provider verification/guardian authorization; OTP remains deferred. See [runbook](docs/NOOR_STAGING_RUNBOOK.md). Track #118; follow-up #46/#56 remain.

## STAGING #114 — VERIFIED remote Cloudflare staging, 2026-10-29
- Frontend account UI #112 merged as [PR #113](https://github.com/geminiamo0-ship-it/nour-elquran/pull/113), main `64eaaa2`, postmerge Verify [40807730642](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40807730642) SUCCESS. Stage-only access guard [PR #115](https://github.com/geminiamo0-ship-it/nour-elquran/pull/115) merged as `dff83b382b3774a7476ae8dee64b7454fd09859c`; postmerge Verify [40808432004](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40808432004) SUCCESS (all four).
- Cloudflare-only remote staging **DEPLOYED and VERIFIED**, using isolated D1 `noor-core-staging` plus Worker `noor-site-staging`, same-origin static Next assets/API, `assets.run_worker_first=true`, server-only Basic access gate, and account/auth secrets. No production Worker/D1 or Santo product resource was changed.
- Verified remote synthetic end-to-end in Santoreno [Noor Staging run 40810303172](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40810303172) **SUCCESS**; companion [Verify 40810302568](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40810302568) SUCCESS; deployed Noor source `dff83b382b3774a7476ae8dee64b7454fd09859c`. Checks unauthenticated assets/API denied 401, gated /health and /ready 200, synthetic registration and `phoneVerified=false`, HttpOnly/SameSite cookie and session restore, two learner profiles, cross-account 404 and logout replay denial.
- This is **staging only with synthetic test accounts**. Email/SMS/WhatsApp OTP deliberately deferred, phone ownership unverified. Human staging access still requires rotating the random private gate credential to an authorized known password/Cloudflare Access. Remote real-browser visual QA, restricted child/staff flows, provider-backed recovery, billing, teacher assignments, private data APIs and cloud D1 restore rehearsal remain separate work under #46, #56 and notebook #102. No real students or messages. See [runbook](docs/NOOR_STAGING_RUNBOOK.md).


## Historical AUTH-02 #112 — same-origin account UI (previous branch checkpoint; merged as PR #113)
- Baseline main #111 `14e73efde6e406dff34603ef053b2f17e789984c` passed all four jobs in [postmerge Verify 40803047786](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40803047786). #110 closed; #43/#46 remain open.
- `feat/112-account-ui` adds a typed/runtime-validated same-origin client, opt-in signup/login/logout/session and owner-profile UI. Connected learner data never uses demo fixtures; raw session tokens/passwords/contact are never persisted by application browser storage. Interrupted registration can recover the existing account/profile.
- Public `NEXT_PUBLIC_ACCOUNT_UI=true` is a build-time UI switch only, OFF by default; server AUTH_ENABLED/D1/secret/origin remain independent requirements. Root Worker composes API paths with static assets so cookies stay same-origin and existing branded asset/404 behavior is retained. No remote D1 binding or authentication secret is checked in.
- New native local Chrome gate builds opt-in UI and uses isolated Worker+D1. Covers response loss after profile insertion, reload/session restore, siblings, HttpOnly cookie, logout replay, cross-account separation, wrong password and expiry; 360/390/1440 screenshots. CI outcome is pending, not inferred from existing backend tests.
- No remote provisioning/deploy, verified phone/recovery, booking/paid/teacher/child login or real-user rollout. Next: pass exact-head CI and review/merge; #46 retains verification/recovery, role policies, staging and operational acceptance.

## AUTH-01 #110 / PR #111 — 2026-10-29, native implementation verified before final handoff
- Main includes #109, merge `a8ea58cdc76c25ad89ff02bb1e280bd3b90559e4`; its postmerge [Verify 40800758113](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40800758113) passed. #46 remains open.
- AUTH-01 implements pinned Better Auth 1.7.14 + Drizzle 0.45.2 on Workers/D1: phone/password registration/login, signed HttpOnly session, D1 revalidation/logout revocation, and owner-scoped learner create/list/read using the existing owner-read SQL boundary. Default OFF until explicitly configured. Phone ownership remains unverified; no OTP/recovery/messages enabled. See [ADR 0005](docs/adr/0005-d1-phone-password-auth.md).
- **Verified code head `e1fd72e68a786d7c41497d124b3c91cc332fce5b`: [Verify 40802629650](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40802629650), all four jobs SUCCESS.** Includes 26 Node + 22 SQLite backend tests, existing frontend/build/Chrome regression, native local migration replay and real Better Auth signup/login, cross-account denial, profile cap, origin/body restrictions, persistent credential throttling, logout replay, account disable and expiry. First run 40802500608 passed native but failed two unused smoke declarations; corrected before the green run.
- Final handoff/docs and explicit session-response assertions follow that code head; inspect their exact-head CI in #110/PR #111 before merge. Native evidence is local, not cloud staging.
- No cloud resources, remote migrations, real users or frontend auth integration. Next exact action after #111: connect existing signup/profile UI via a separate issue; #46 also retains phone verification/recovery, restricted child/staff flows, isolated staging and operational acceptance.

## Active #46 native local runtime gate — 2026-10-29 (unmerged)
- Baseline main `dc3da3e041c57e9e6af8734fc2bb323885f9be60` is the merged CF-01 #108; [main Verify 40792047893](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40792047893) passed. #104 is CLOSED; #46 and #102 remain OPEN.
- Branch `test/46-native-local-d1-worker-gate` adds a disposable **Wrangler local** D1 migration replay + Worker HTTP gate to Verify. It checks the actual Worker D1 binding reports `database: ready` while all protected routes stay closed even with forged headers. Uses pinned Wrangler 4.45.0; no cloud account, remote D1, deployment, user data or new runtime dependencies.
- **Verified native local CI:** PR #109 code head `c098fad5476ee276e17887e3a32c8cdca4f52fb9` passed [Verify 40795971889](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40795971889): all four jobs SUCCESS, including `cloudflare-local-d1` (Wrangler executed 26 local migration SQL commands; second apply reported no pending migrations; Worker `/ready` found schema and stayed auth-closed). This proves native **local** Worker/D1 behavior only, not cloud staging. Subsequent documentation-only commits need their own exact-head CI. Next: fix any native runtime/SQL failures; then #46 maintained auth library + verified sessions and isolated Cloudflare staging after appropriate provisioning authorization. #102 frontend notebook can proceed independently.


Current integration baseline: main `df284bcf00e81b6199067d6d9386eb2e10a35997` (merged #105 static Next.js export/Workers assets fix). CF-01 preserves those files. Draft #107 overlaps the foundation and is consolidated in #108 with one migration lineage and the revised #103 plan.

## Current checkpoint — Cloudflare adoption, 2026-10-29 Cairo (#104)
Owner approved Cloudflare-only infrastructure. [ADR 0004](docs/adr/0004-cloudflare-only-platform.md) supersedes Supabase Auth/PostgreSQL/RLS and the previous LiveKit provider choice. RealtimeKit and Workers/vinext are targets requiring their own verified integration; no frontend or media cutover occurred here.

CF-01 branch adds a real Worker handler with health/schema checks and fail-closed learner routes, pure server-input authorization helpers, strict D1 migration for account/learner/teacher/lesson/private annotations, and Node/SQLite regression tests. Protected routes remain 503 AUTH_NOT_CONFIGURED. No real auth, remote D1, production SQL, private upload, backup job, A/V, payment or messaging is implemented/provisioned.

Local targeted checks: 18 Node tests and 19 Python SQLite tests pass, including ownership constraints and SQL export/restore roundtrip. Full exact-head GitHub Verify must be linked in #104/PR; local tests are not native Cloudflare evidence. [Runbook](docs/CLOUDFLARE_BACKUP_AND_RESTORE.md) specifies Time Travel and longer export/recovery scope, with no remote restore performed.

Next exact backend action: #46 integrate maintained auth on Workers/D1, actual isolated staging config and native D1/session/authorization verification. #102 notebook frontend remains open and must use real contracts without claiming this foundation saves student data. PR #103's plan is included and revised by this continuation; old plan/backend descriptions below are historical.

## Earlier planning checkpoints


## Current checkpoint — 2026-10-29 Cairo, planning issue #101
- Inspected main at `906a993d0ea350591692045fa878da34995d7c1c`; Training PR [#100](https://github.com/geminiamo0-ship-it/nour-elquran/pull/100) is merged. Native Next.js student frontend and Quran reader exist with explicitly temporary/demo learner state. This supersedes older foundation-only status descriptions below.
- Owner requested a complete notebook/backend-readiness plan. [Detailed Arabic plan](docs/LESSON_NOTEBOOK_AND_BACKEND_READINESS_PLAN.md) covers notebook UX, schema/API, roles/RLS, immutable publication, Mushaf projection, private media, recovery, operational dependencies, phased delivery and future acceptance tests.
- This documentation branch `docs/101-notebook-backend-readiness` implements no notebook renderer, backend, migrations, private upload, LiveKit, payment or WhatsApp. No deployment/provisioning or messages.
- Next frontend task: [#102](https://github.com/geminiamo0-ship-it/nour-elquran/issues/102), filtered Notebook viewer/contracts on the existing renderer. Next backend start: B0/B1 under [#46](https://github.com/geminiamo0-ship-it/nour-elquran/issues/46), identity/account/learner ownership and RLS before real records.
- Exact-head CI must be inspected and linked in #101; no test result is inferred from a prior PR. One backend integration milestone is delivered through ordered PRs.

## Historical checkpoints — retained for provenance; read current checkpoint first

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

## 2026-10-28 — STU-AZ S03 trial and recurring lesson preference preview (PR pending)
- Branch `feat/75-student-trial-scheduling-s03`, Issue #75. Dashboard CTA now leads to trial booking section inside student Lessons. Does not promise any confirmed slots.
- S03 UI shows 0 EGP, 30-min once/learner demo trial rules, time-of-week/day preference and explicit review step with automatic Sheikh assignment pending server verification. Mock cannot send/confirm booking. Existing trial state clearly marked example; paid weekly selection is preference only, cannot charge or reserve.
- `booking.ts` typed eligibility and six-hour confirmed-lesson reschedule policy; unit+Chrome checks. No booking/teacher assignment/renewal ledger backend created. Review exact-head CI before merge.

## STU-AZ S04 — Real 604-page Quran reader (2026-10-28; branch/CI pending)
- Replaced 4-ayah classroom fixture with a modular `MadinahReader` in `/student/mushaf`: 604-page page-number navigation, safe `img` SVG display, independently fetched verified sidecar references, `آية بآية` from Uthmani source verses, per-learner temporary typed note preview, direct source fallback. No Arabic Quran text was generated or altered.
- Source: Quran.ws version-locked Hafs-KFGQPC SVG v1.1.1 (publisher KFGQPC artwork) and Quran JSON Uthmani Hafs chapters. Frontend prefers dedicated R2 Worker `noor-quran-assets`, falling back to named versioned public sources until upload/Worker is operational. Source attribution and publisher usage rights retained.
- `santoreno` PR #216 (Issue #215) provisions **new isolated bucket** `noor-quran-hafs-v1` and read-only `noor-quran-assets` Worker via its existing Cloudflare Actions secrets; **merge and remote workflow validation pending**. Do not claim bucket exists, that 604 assets were uploaded, or production is deployed until verified.
- No canonical word-level interaction, persistent per-learner annotations, styled mini-player, signed media, or classroom recordings: these belong to S05–S09. Screenshot/production and exact-head CI still required.

## 2026-10-28 — Quran reader experience (#85)
- One batch feature branch for smooth fixed-aspect SVG page rendering, decode-before-swap with last page retained, bounded 10-neighbor preloading (3 concurrent), responsive immersive mobile and bottom paging controls.
- Verse/word source-text selection, private notes list with direct page/ayah jumps, highlighter, S Pen/mouse strokes, marker, eraser, undo/redo, global Hafs search validated against 6,236 ayah page markers. Never modifies canonical Quran text.
- Vercel preview deployments DISABLED temporarily on 3 Noor linked projects to conserve build quota. PR must pass exact-head GitHub Verify before one merge. Production deploy separate.
- All ink/notes are DEMO local memory only; real teacher approved notes and classroom sync, durable private storage and audio/tafsir service require backend/auth/rights. Do not claim those as live.

## 2026-10-28 — Quran P0 #88 physical touch regression hardening (PR #89, unmerged)
- The existing browser smoke simulated `Element.click()` on a printed ayah path, which could pass even if the polygon was clipped, covered or pointer-disabled. Replaced it with viewport hit-testing via `document.elementFromPoint` and actual Chrome DevTools `Input.dispatchMouseEvent` press/release; the test then requires the note editor to open. This is a stronger browser interaction gate, not yet proof of human touch-device usability.
- Changed `scripts/browser-smoke.mjs` on `fix/88-quran-reader-mobile-interaction`, commit `6fe1890782c493850c10b664a32e93cae4df7e6b`. Existing P0 unit/Chrome and responsive tests remain. Check the exact latest PR head GitHub Actions after subsequent documentation commits; do not merge until green and required review.
- No changes to scripture, secrets, production, R2, payments or student records. Notes remain session-local. Next: inspect real pointer-test CI and 390px screenshots, correct any clipping/hit failures, then request human mobile visual review.

## 2026-10-28 — S04 Quran reader app-shell redesign (issue #90, pending CI)
- Owner approved taking QuranFlash's information architecture as inspiration only, not visual copying. Replaced dashboard wrappers on Quran route with a dedicated reader, compact toolbar, index/settings drawers, large desktop spread, one-page mobile default and retained source-accurate Quran assets, notes, search and drawing.
- Separate per-leaf metadata with clickable verse polygons, so both printed pages of desktop spread are interactive. Navigation: surah selector/604-page input, bookmarks local to session, surah index sourced, settings for single/double/auto and swipe/buttons. Juz precise page source not present: listed as not yet available instead of guessing. No fake licensed tafsir/audio.
- Preserve learner-key reset, R2 preferred and pinned fallback. Local notes/marks are not server-stored, no teacher sync; issue #87. Vercel Preview Deployments remain disabled to protect quota; no per-commit Vercel deploy.

## Quran S08 reciter/player UI — 2026-10-28, branch #92 (pending CI)
- Per owner: defer all PostgreSQL/backend/auth to final platform phase. Add actual reciter player on existing native Next.js reader only. Six Hafs readers from published Mushaf-Learning MIT metadata; verse streams directly from EveryAyah (no copying or storage), user gesture needed. Scope selected ayah/page/full surah, repeat 1/3/5, speed 0.75/1/1.25/1.5, pause/next/previous/seek with live verse highlighting and explicit error handling. No fake word-level timestamps, offline media or teacher sync.
- External audio recordings **not MIT by inheritance**: https://github.com/Mushaf-Learning/quran-audio explicitly disclaims audio redistribution rights; verify upstream streaming permissions before treating site as production-cleared. King Fahd Complex grants app/site use for ITS OWN five Hafs audio sets: https://qurancomplex.gov.sa/quran-audios/ ; those files are a separate, potentially preferred official import and must not be mislabeled as EveryAyah recordings.
- CI includes URL/sequence unit tests + Chrome reciter selector/no-autoplay/rate/repeat panel. Vercel branch previews remain disabled to preserve build limit. No Postgres or APIs touched.

## 2026-10-28 — Quran page-first compact controls (#94, CI pending)
- Owner smartphone screenshot after S08 showed Quran shrunk under audio, toolbelt, footer and redundant metadata. Frontend-only UX fix: 38–40px audio strip, expand-on-demand popover reciter/scope/repeat/speed/scrub, 39px mobile header, 35px icon toolbar, 40px bottom pagination. Reader geometry no longer applies old `audio-open => (100dvh-270px)` override. All controls remain accessible without backend.
- Advanced options float over reading canvas only while explicitly opened; they do not change page dimensions, while collapsed reading remains the default. Real hide/show tools toggles CSS visibility rather than just a label. No autoplay changes and no audio hosting changes.
- Added Chrome short-phone 375x667 geometry assertions: full Quran sheet, audio dock <58px, unchanged sheet after expanding options and all legacy features still present. Screenshot retained in GitHub Actions. Previews disabled on Vercel to preserve daily quota.

## 2026-10-29 — Quran touch, tap, and canonical lesson architecture (#97)
- Owner-approved: subtle 190–220ms page-turn reveal AFTER decoded image swap (fixed image geometry and previous image retained), first same-ayah tap selects/highlights only, second within 450ms opens note; keyboard Enter/Space directly opens note. Same in verse-per-word mode. Added touch marker/pen support: active drawing captures pointer including finger (old condition explicitly rejected touch), transparent SVG pointer target, `touch-action:none` in draw mode only, cancellation not committed.
- Marker/pen options now vertical animated 5-color/pencil/eraser/undo/redo/browse popover under toolbar icon; no horizontal bars or page displacement; reduced-motion styles. Real CDP pointer/touch smoke and 3 interaction unit tests.
- One cumulative canonical Mushaf per learner, teacher-approved lesson layers later merged into it; Notebook shares same Quran renderer but shows only that lesson's pages/ayat and published strokes/comments. See `docs/QURAN_CANONICAL_MUSHAF_AND_LESSON_VIEWS.md`. No false promises of Backend: all Auth/PostgreSQL/RLS/teacher realtime deferred by owner to ONE final integration phase.
- Branch `feat/96-mushaf-page-turn-ink-double-tap`, Issue #97, wait for exact-head green CI before merging. Vercel Preview Deployments remain off to preserve Hobby quota.

## 2026-10-29 — Training/Notebook/Mushaf functional separation, issue #99
- User approved keeping all three sections distinct: Mushaf cumulative personal book, Training = upcoming teacher-approved homework + self-memorization/review + preparation, Notebook = past lesson with published teacher annotations on same shared viewer. `TrainingWorkspace` replaced old stacked Wird+textarea with three accessible tabs and explicitly demo-only teacher tasks.
- Teacher demo assignments now have Quran-specific structured range references (surah 112/113 page 604, exact ayah ranges), reused `ReaderPrintedPage` with bounded source hit regions and source text, reveal/hide cards and optional browser-only microphone playback. No server persistence/transmission, no real teacher submission. Original new learner has genuine blank homework and no booked lesson; voluntary practice is clearly independent.
- Next stage: filtered archival Notebook viewer UI, then remaining student pages; all auth/backend/PostgreSQL remain deferred to final one-shot phase. See `docs/STUDENT_TRAINING_NOTEBOOK_INFORMATION_ARCHITECTURE.md`.



## 2026-10-29 — Classroom booking eligibility hardening (PR #121)
- New D1 triggers reject new scheduled bookings and canceled-slot reactivation/reassignment when the acting teacher is disabled or not qualified. Existing completed historical lessons remain unchanged; qualification is not a substitute for runtime role/presence authorization.
- Added three synthetic SQLite regressions for ineligible insert, canceled reactivation and atomic reassignment/history. Branch commit `f957c31f0e425b44b93cd28e86e4267ec859cee0` contains the code/tests; **exact-head CI remains to be checked** after documentation updates. No remote migration or production changes.

## 2026-10-29 — Classroom implementation begins: 40-minute booking guard (#120 / PR #121)

Owner authorized execution of the full classroom implementation plan #120. A focused **draft/unmerged** PR #121 proposes `0003_teacher_schedule.sql` to enforce 40-minute teacher+learner bookings and no overlaps, with SQLite regression tests. Preserve 30-minute instructional entitlement, manual teacher-only Start/End, and 40-minute calendar interval as distinct concepts. No actual classroom media/sync, scheduler HTTP endpoint, remote migration, or production deployment is claimed. Next: exact-head CI, migration compatibility, then a separate teacher/learner presence and Start/End lifecycle issue/PR; reconcile LiveKit Cloud versus RealtimeKit ADR before media integration.
