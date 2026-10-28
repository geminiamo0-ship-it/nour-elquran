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

## 2026-10-28 — Quran spread turn semantics (#90, branch CI pending)
- Branch `fix/90-quran-spread-turn-navigation` starts from current `main` after merged compact reader PR #95. Issue #90 remains OPEN for final responsive/visual acceptance.
- Fixes an observable desktop UX defect: when pages 2–3 or 4–5 share a spread, Next previously advanced the internal page by 1 and could display the *same* spread twice. Previous could similarly appear inert. A pure `getAdjacentReaderPage` now advances one visible spread on desktop, one page on mobile/single-page/ayah modes, including 1/604 boundaries. Footer controls and swipe use the same rule; direct page/surah/ayah jumps remain exact.
- Adds pure unit cases for odd/even anchors and boundaries, real Chrome desktop forward/back turn sequence, and a 768px single-leaf/no-overflow screenshot gate. No Quran text/source, audio, auth, backend, private data or deployments changed.
- **Verification pending:** inspect exact PR head Verify run (lint, strict TS, unit, Next build, HTTP and Chrome) before any merge. Human RTL/screenshot review remains necessary; #1 main protection still unverified.

## 2026-10-28 — Quran tablet viewport follow-up (#90, PR #96; pending exact-head CI)
- On existing draft PR #96, updated `MadinahReader.tsx` to enter full-viewport immersive reader mode for tablet widths below 900px (previously only <=700px), including resize into tablet width. This keeps the student dashboard header behind the reader and reuses the existing body scroll lock and exit-to-student behavior. Desktop double-spread behavior is unchanged.
- Extended `scripts/browser-smoke.mjs` at 768x900 to assert the reader touches the viewport edges, page and bottom pager are visible, body scrolling is locked and the reading stage has no nested vertical overflow. Existing tablet one-page turn, desktop spread, mobile and audio tests remain.
- This is a proposed fix, **not yet a verified browser result**. Inspect latest PR head Actions and screenshot artifact before reviewer acceptance or merge; if the new geometry assertion fails, diagnose real computed dimensions rather than weakening the gate. No production deploy, auth, DB, R2 or student data changes.

## 2026-10-29 — #90 tablet stage overflow follow-up (PR #96, exact-head CI pending)
- Rechecked PR #96 head `55461520973584dfe4e75c570e584c7f33721900`: [Verify 40762650066](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40762650066) **FAILED** in `code-quality → Browser RTL and responsive smoke`. Lint, strict TS, unit tests, Next production build, HTTP smoke and earlier Chrome paths passed; governance jobs succeeded. At 768×900 the fullscreen reader/footer/leaf/body lock passed, but `bookStage.scrollHeight > clientHeight+2` (nested stage scroll) failed. Never call that SHA green.
- On existing Draft [PR #96](https://github.com/geminiamo0-ship-it/nour-elquran/pull/96), `MadinahReader.module.css` now sizes the tablet printed leaf from the **actual available stage height** using a CSS size container / `cqh`, reserving room for caption, error banner and optional player; `scripts/browser-smoke.mjs` now prints stage/leaf geometry on failure without weakening the assertion. Commits `9fffefa0` and `32b6c70b` on `fix/90-quran-spread-turn-navigation`. **New exact-head CI has not been verified yet.**
- No merge, deploy, real learner data, Quran text/media changes or paid resources. Next: inspect CI for `32b6c70b`; if red, use new geometry diagnostics to fix layout, then review tablet screenshot and obtain required human approval before merging.

### 2026-10-29 — #90 desktop reader chrome and screenshot review (pending new CI)
- The tablet stage-height fix and diagnostics passed **exact-head** [Verify 40770633906](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40770633906) at `c28c17b441039d23fb2e53279e2addb38ae264a0`: all three jobs succeeded (lint, strict TS, unit, build, HTTP and Chrome smoke). Screenshot artifact `12852681274` was downloaded and visually inspected: 768×900 shows one centered leaf and fully visible footer; 390 mobile remains single-leaf. **Desktop 1440 screenshot still had the student header and outer scrollbar**, so this is not full #90 acceptance.
- Follow-up commits `20078fd4` and `d98a0d24` make the Quran route immersive by default on desktop too, and assert full-viewport/visible footer/body scroll lock in Chrome. The user can still exit desktop immersive mode via the existing control. **Reverify latest head CI and new 1440 screenshot before any merge.** No deployment or private-data changes.

### 2026-10-29 — #90 verified desktop/tablet reader viewport (Draft PR #96)
- **Latest code+handoff head `9a35228c055d16ac0919778f183c5c8b3fd6a808`** passed [Verify 40770979097](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40770979097) SUCCESS: all three jobs, including Chrome tablet no-nested-scroll and desktop full-viewport footer assertions. Screenshot artifact `12853175403` downloaded and visually inspected (1440 desktop spread/index, 768 tablet single leaf/footer, 390 mobile).
- Desktop no longer shows student dashboard chrome/outer scrollbar by default; reader can be exited using the existing desktop control. This is a frontend-only fix; no Quran content, student data or deployment changes. **PR #96 remains Draft and Issue #90 OPEN** for reviewer and physical-device/S Pen/keyboard acceptance.
- This documentation-only update itself requires an exact-head CI recheck before claiming the new branch SHA green.

### 2026-10-29 — #88/#90 intermittent Quran SVG overlay styling race (new CI pending)
- Documentation-only head `b5a01a92` failed [Verify 40771300030](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40771300030) in mobile Chrome polygon physical-tap gate, despite prior exact code run `9a35228c` green. Downloaded failing screenshot artifact `12852741690`: **opaque black polygon blocks covered the Quran page**, consistent with interactive SVG paths appearing before their CSS styles. Do not classify this as a harmless test flake.
- Added presentation-attribute transparent fill/stroke fallback to `QuranAyahOverlay.tsx` (commit `a567cedb`) and changed browser smoke to wait for actual overlay/path CSS readiness before hit-testing (commit `79cfeec1`). This preserves the strict physical pointer assertion and prevents the black fill while CSS is loading. **Recheck new exact-head CI and mobile screenshot**; PR #96 remains Draft.

### 2026-10-29 — #90 keyboard reader drawer accessibility follow-up (Draft PR #96)
- After green head `837ecc691893963d7705fc98d96ffb89263d42fb` / [Verify 40771654395](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40771654395), the reader drawer still opened without moving keyboard focus inside and did not support Escape-to-close/trigger focus restoration.
- `MadinahReader.tsx` now remembers the focused opener, focuses the drawer close action on mount, and restores focus on Escape or close; `scripts/browser-smoke.mjs` tests real Chrome Enter open, focused close action, Escape close and original trigger focus. No keyboard trap is introduced (drawer is nonmodal).
- **Pending:** new exact-head Verify CI and 1440px browser screenshot; human RTL/physical-device review still required. Draft PR #96 and Issue #90 remain open; no backend, private data, R2, payment or production changes.
