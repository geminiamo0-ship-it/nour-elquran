## 2026-11-01 — #317 follow-up after Verify 41345886728
- New CI result: [Verify 41345886728](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41345886728) on `e27bce29` has code-quality failure. The SQL approval-time eligibility guard did reject the dequalified Sheikh; failure was the Python regression's accumulated immutable rejection count (1 vs expected 0). A failed subtest then left the Sheikh dequalified and caused a secondary setup error.
- Commit `11f2bddd` now asserts per-subtest decision count deltas and uses `finally` to restore qualification/status, preserving independence. **Check exact new HEAD Verify**; no pass claim yet. The migration 0031 guard remains source-only and unverified on remote Dev.
- NEXT: obtain 4/4 CI and independent security review; signed D1 0031 Dev owner/staff/sibling/credit/mobile E2E still required. PR #318 Draft, #317 OPEN; no Production changes.

## 2026-11-01 — #317 Draft PR #318: CI regression and approval guard repair
- Inspected actual [Verify 41342708600](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41342708600) on head `7e51b1af`: 3/4 jobs success; code-quality failed in Python unit tests, not lint or TS. Repro was a post-request Sheikh qualification revocation still allowing approval and one decision row.
- Updated migration 0031 to enforce **fresh, transactional approval-time** learner/owner and Sheikh qualification/status/assignment eligibility. Added suspended-Sheikh negative regression to the native test. Rejection of a stale proposal remains permitted, without a lesson/spend.
- No local full test or remote Dev test was run in this turn. **New head CI must be checked before claiming success**; source-only changes remain on `feat/317-paid-slot-request-ledger`. No merge, feature flag, Production, provider, WhatsApp or audio changes.
- NEXT: inspect latest PR #318 head and its matching Verify jobs; if red, fetch failing job logs and repair; if green, obtain independent review and signed isolated Dev migration 0031 + owner/staff/sibling/credit and mobile acceptance before ready-for-review/merge.

## 2026-11-01 — #317 paid-slot security test follow-up
- Prior Draft head `f8d0aa3b8f9caa2240920db5978bc101e3ee6b56` completed [Verify 41337169021](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41337169021) SUCCESS 4/4. Do not transfer that status to a later HEAD.
- Branch `feat/317-paid-slot-request-ledger` now includes a native regression for post-request learner archival/Sheikh qualification revocation: approval must atomically fail with no lesson/credit debit; explicit staff rejection remains possible. Await exact-head Verify and independent review.
- Identified product/security gap: guardian can submit arbitrary timestamp within assigned teacher/valid cycle; no server-published **paid** slot availability contract exists. Do not reuse trial slots, enable a fake picker, or merge #318. Next: staff-authored paid availability event + owner-scoped signed options + D1 guard at proposal/approval, tests and Dev E2E. Production untouched.

## 2026-11-01 — #317 continuation: guardian proposal network contract
- Reviewed AGENTS/status/plan/security/tests and live PR #318. Previous `d071dc49` Verify [41331326021](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41331326021) completed 4/4 (not current-head evidence after new commits).
- On existing Draft branch `feat/317-paid-slot-request-ledger`, added `submitPaidSlotProposal` + `parsePaidSlotProposalAck` in `apps/web/src/features/student/paid-slot-requests-client.ts`; strict exact-input/ACK, signed POST, explicit uncertain-network outcome. Added focused Vitest regressions in `paid-slot-requests-client.test.ts` including immutable retries and no false debit.
- **NEXT exact action:** inspect latest PR HEAD GitHub Verify and repair any lint/type/test failures. Then add server-derived owner-visible eligible teacher/cycle/slot options (do not invent them in the browser), connect a small guardian proposal form, and perform independent SQL/security review + source-pinned D1 0031 signed Dev/360–390/sibling acceptance. No merge/Production/finance provider/WhatsApp/child audio/cumulative-ink flag.

## 2026-11-01 — #317 D1 false-success guard on PR #318
- Read current main, open Issues/PRs and required guardrails. Continued existing Draft branch `feat/317-paid-slot-request-ledger` rather than reopening merged work.
- Source-only fix in `workers/api/src/academy-paid-slot.ts`: both guardian and staff `run()` writes require `success===true` and positive safe integer `meta.changes`. Failed/zero-change acknowledgements return 503 `ACADEMY_PAID_SLOT_WRITE_UNCONFIRMED`; no confirmed booking or credit claim. Tests in `workers/api/tests/academy-paid-slot.test.ts` exercise both paths and successful baseline.
- No local full workspace run: GitHub hostname could not resolve in container. Exact new-head Verify is required; prior Verify #41325954504 passed only older head `5b2a342d`. No Dev/Production mutation or feature flags.
- NEXT: inspect PR #318 exact-head CI, repair regressions, independent SQL/auth/privacy review and source-pinned signed Dev 0031 guardian/staff/sibling/credit acceptance. Guardian trusted-slot proposal form remains outstanding. Leave PR Draft and Issue OPEN.

## 2026-11-01 — #317 CI lint failure found and syntax corrected
- Previous PR #318 head `23cc802d0842d449a7196161c3275623ba4f3f49` DID run [Verify #41323404170](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41323404170): policy/governance/native D1 succeeded, code-quality failed at Lint (admin-paid-slot-client.test.ts line 32, extraneous `]`), so TS/unit/build/smoke never ran.
- Corrected the 101-row limit test syntax on PR branch: commit `5c22c645b0f753e54e96a1416f6f6054b78c3c4c`. GitHub Actions new-head result was not yet available when checked; no full local run because github.com DNS resolution failed. Do not claim 4/4.
- NEXT: verify latest PR head and its actual CI jobs, then independent review and signed Dev D1 0031 two-role/sibling/viewport acceptance; guardian trusted-slot proposal UI still pending. Do not merge or touch Production/financial integrations.

## 2026-11-01 — #317 latest-main reconciliation handoff
- Draft PR #318 incorporates main 4c15b59f713f41e2be9999bb082118cc48496c10 while retaining #322 premium Lessons and #319 Admin refresh, plus new paid-slot status and staff decision inbox. Native D1 0031 and Worker contracts unchanged.
- Exact-head Verify and local full tests remain unverified; GitHub DNS unavailable in local container. Independent review and signed Dev two-role/sibling/mobile acceptance required. No merge/Production/payments/WhatsApp/voice/ink flag.

## 2026-11-01 — #317 staff paid-slot approve/reject controls (PR #318; source-only)
- Added admin-paid-slot-decision-client.ts (exact POST, strict 201/200 ACK parser, UUID and state checks, fail-closed 409/403/503/offline) and AdminPaidSlotDecision.tsx. Only pending rows expose a reason+explicit confirmation form; no optimistic credit/booking claim. Network-unknown outcomes retain the exact operationId and payload for explicit same-operation replay, not a second decision. Added parser/POST and SSR tests, mounted in AdminPaidSlotInbox.
- GitHub connector committed source on feat/317-paid-slot-request-ledger; no local workspace run (github.com DNS unavailable), exact-head Verify or signed Cloudflare Dev acceptance yet. Main advanced 3 commits and PR #318 is mergeable=false; reconcile AdminShell/ConnectedClassroomLessons and documentation against latest main without losing premium UI.
- NEXT: inspect current HEAD/CI, fix any TypeScript/Vitest failures, reconcile main, independent SQL/auth/privacy review, then signed Dev guardian/staff/foreign-owner/sibling D1 0031 + mobile 360/390 tests. Guardian verified-slot proposal UI remains pending. Do not merge, enable payment or deploy Production.

## 2026-11-01 — #317 Admin paid-slot read-only inbox continuation (PR #318)
- Re-read AGENTS/status/master plan/guardrails/security/test strategy and current GitHub Issues/PRs. On `feat/317-paid-slot-request-ledger`, added `admin-paid-slot-client.ts`, `AdminPaidSlotInbox.tsx`, adjacent Vitest/SSR tests and mounted the inbox below existing subscription/trial requests in `AdminShell.tsx`.
- Endpoint is existing signed `GET /v1/staff/academy/paid-slot-requests`, gated by Admin opt-in, current Better Auth session, D1 `roles.manage` and schema 0031. Client rejects unknown/PII fields, duplicate IDs, malformed names/UUIDs/times/states; lists at most 100, never claims all records. Session changes hide old data before effect cleanup.
- **Evidence limit:** GitHub connector writes completed; no local full test because container cannot resolve github.com, and no exact-head GitHub Verify observed before this slice. No independent review, Cloudflare Dev acceptance, approved staff decision UI, guardian verified-slot selector or Production activation.
- **Next exact action:** check PR #318 current head and Actions; fix any TS/Vitest/SQL errors; then review and implement the audited staff approve/reject UI with stable operationId retries, and guardian available-slot proposals, followed by synthetic signed Dev owner/staff/foreign-owner/sibling and 360/390 QA. Do not merge or deploy Production.

## 2026-11-01 — #317 signed owner request-status slice (PR #318 still Draft)
- Branch `feat/317-paid-slot-request-ledger` adds `apps/web/src/features/student/paid-slot-requests-client.ts` (strict 30-row parser), `components/StudentPaidSlotStatus.tsx` and Vitest regression; mounts in signed `ConnectedClassroomLessons` keyed by learner. Displays only server-backed pending/approved/rejected status, never fake booking, teacher availability or credit spend.
- Network/schema/auth errors are explicit; a profile switch aborts old request. Does not expose staff details, contact, reason or sibling data. No new migration beyond existing 0031 and no operational flag changes.
- NEXT exact action: check latest PR #318 HEAD SHA and Verify 4/4, repair failures, request independent SQL/privacy review, then source-pinned Cloudflare Dev signed guardian/staff/foreign-owner/sibling and 360/390 checks. Student proposal controls and Admin decision inbox are still absent. No merge/Production.

## 2026-11-01 — #317 D1 unique-race idempotency continuation (Draft PR #318)
- Read current main/PR/Issue and guardrails. Fixed a source gap: simultaneous same-operation guardian or staff POST could both miss initial SELECT, then losing INSERT returned 409 although matching event was saved. The paid-slot module now re-reads operationId on recognized constraint failure and returns winner requestId/lessonId only for same actor and full immutable payload, otherwise 409.
- Node regression simulates both race paths, mismatch and revoked-role cases. Candidate tests, NOT verified execution. Clone cannot resolve github.com here; no local test. Exact-head GitHub Verify absent for previous head and must be checked for new head.
- NEXT: check PR HEAD and CI, fix failures, independent SQL/auth review, then connected Student/Admin UI and signed Cloudflare Dev D1 0031 owner/staff/sibling/mobile E2E. No merge, remote migration, Production or sensitive feature activation.

## 2026-11-01 — #317 expired paid-slot POST replay hardening (PR #318, source only)
- Re-read current main, AGENTS/plan/security/test/engineering docs and #317 before editing. Found owner POST rejected identical idempotent retry when its original proposed slot became too old: time validation preceded operationId lookup.
- On existing Draft PR #318, commits `7848381` (move temporal guard after owner-scoped exact replay) and `f96035c` (Node regression for expired exact retry, fresh expired denial and revoked owner) preserve immutable D1 request semantics without allowing stale new bookings.
- **Do not claim tests passed yet**: exact-head GitHub Verify not evidenced at write time. Cloudflare preview build is not native CI or signed Dev D1 acceptance. No merge, production deploy or activation.
- **NEXT:** inspect PR #318 exact HEAD, Verify 4/4 and independent SQL/security review; if green, continue signed owner/staff UI + Cloudflare Dev 0031 migration and sibling QA. Leave #317 open. Do not touch payments/WhatsApp/R2 audio/cumulative ink.

## 2026-11-01 — #317 signed owner/staff paid-slot API source continuation (PR #318)
- Checked current GitHub main `4c15b59f713f41e2be9999bb082118cc48496c10`, open #317/#286/#155, PR #318 and exact-head prior Verify #41289256070 (4/4 on `ecdee494`). Read AGENTS, status, plan, architecture, test/security/privacy and existing #315 academy endpoints before editing.
- Added `workers/api/src/academy-paid-slot.ts` and wired schema-gated signed owner/staff GET/POST routes in `auth/routes.ts`. Server-only timestamps and Better Auth subject, current D1 staff grant, strict request fields, replay-safe operation IDs; decision insert relies on 0031 + 0030 atomic triggers, never direct credit mutation. Staff flag remains OFF unless approved separately.
- Added `workers/api/tests/academy-paid-slot.test.ts` for denial, owner isolation, bounded reads, exact replay, no client clock/role, sanitized constraint errors and fail-closed staff decisions. No migration deployed and no UI/Dev E2E accepted. Current branch CI must be checked at the final docs HEAD, not inferred from prior 4/4.
- NEXT: review exact-head CI and any errors, independent API/SQL security review, then wire Student Lessons request + Admin Requests inbox and run source-pinned Cloudflare Dev signed owner/staff/sibling/360/390 tests. Do not merge PR or close #317 until gates pass. No Production/payment/WhatsApp/child audio/cumulative-ink activation.
## 2026-11-01 — #317 pending-slot revocation gate regression (PR #318)
- Reviewed live open #317, Draft #318 and 4/4 successful prior Verify #41286181693 on head 25c6f36. Added native regression to existing `test_academy_paid_slot_requests.py` for teacher assignment revocation after proposal, and staff grant/verification/account revocation before a decision; no lesson, decision or spend may be created on denial. Stale proposal can still be explicitly rejected by valid staff.
- Test-only change commit f895ad3 on existing Draft branch. Exact new-head CI and independent review still required; do not mistake the prior 4/4 run for this commit. NEXT: inspect new Verify and fix failures, then server-derived timestamps, signed owner/staff API, student/Admin UI, staged 0031 migration and isolated role/sibling/mobile acceptance. No Production or paid integration activation.

## 2026-11-01 — #317 decision chronology hardening on Draft PR #318
- Current repository rechecked; #317 remains OPEN, PR #318 Draft. Source D1 migration 0031 now rejects staff approval/rejection when decision `at_ms` precedes guardian proposal `requested_at_ms` (error `ACADEMY_DECISION_PRECEDES_REQUEST`). Added native SQLite regression for both decision types and no phantom booking/spend.
- Commits edb8ef8 (SQL) and d198a68 (test) on branch `feat/317-paid-slot-request-ledger`. Do not confuse source push with CI, Dev acceptance, or release. Local full-repo clone unavailable in this run (container DNS could not resolve github.com); inspect GitHub Actions on exact new HEAD.
- NEXT: CI + independent SQL/security review, then signed guardian/staff API with server-only clock, student request/Admin inbox, isolated Dev two-role and sibling QA. No production/payment/WhatsApp/media/flag changes; keep #317/#155 open.

## 2026-11-01 — #317 D1 expired pending request recovery, continuation of Draft PR #318
- Latest checked main `b54eeb84ac3cf3715bebbaa27f492e85a4d761fd`; Draft #318 head was `447b8b9` with prior 4/4 Verify #41280097038 before this follow-up. No independent PR reviews.
- Migration 0031 pending-request guard previously treated an expired undecided proposal as pending forever. It now excludes old slots at/before the approval cutoff relative to NEW.requested_at_ms (must be trusted server time when API is implemented). Added native regression proving old approval still fails and fresh approval debits exactly once.
- NEXT: inspect exact-head PR #318 GitHub Verify after this change, fix failures, obtain independent D1/security review, then implement signed owner/staff API + UI as separately verified slices; test actual Dev migration and sibling isolation. No Production/WhatsApp/payments/child audio or cumulative ink flag changes. Keep #317 OPEN.

## 2026-11-01 — #317 guardian paid slot requests, migration-only slice
- Re-read AGENTS, status, master plan, engineering/security/test guidance and current GitHub #315/#316/#317/#314. Baseline main `1d8abffaea34d1da5faac9f91c34ff761b4617b8` after merged Admin MVP #316. New branch `feat/317-paid-slot-request-ledger` implements only D1 0031 + full-migration native tests, with no HTTP exposure.
- Decision: never debit credit on a guardian proposal; approval must pass fresh staff grant and reuse #315 booking trigger in the SAME SQLite transaction. On any conflict the decision insert rolls back and request remains pending. Rejection never creates lesson or spends. Preserve immutable audit and profile isolation.
- NEXT: inspect PR exact-head CI and repair migration/test failures, obtain independent SQL/security review. Add strict owner request/list and staff pending/decision endpoints + RTL UI, then Dev signed E2E with 2 roles/siblings and 360/390/1280. Keep #317 OPEN and NOOR_CUMULATIVE_INK_ENABLED OFF. No Production, gateway, WhatsApp delivery or child audio.

## 2026-11-01 — Student premium four-route redesign, PR #323 (source-only)
- Owner's reference is the user-approved Quran-on-rehal screenshot from 2026-11-01. Canonical decision [ADR 0010](adr/0010-premium-student-portal.md) and [Issue #322](https://github.com/geminiamo0-ship-it/nour-elquran/issues/322). Branch `feat/student-premium-ux-322` targets `main`, PR #323 Draft.
- Components: `StudentShell.tsx` + new `StudentPremium.module.css` for branding/nav/profile/bell/mobile, `PremiumHome.tsx` reused by demo and signed `ConnectedStudentDashboard.tsx`, `LessonHub.tsx` schedule/notebook/reports tabs with deep-link compatibility via `StudentSection.tsx`, styles in `StudentPortal.module.css` + Training CSS, `public/noor-hero.webp` from owner-approved reference.
- Source data from `notebookClient.lessons`, `assignmentClient().owner`, `lessonReportsClient.student`; only real `live` lesson may show one-click actual classroom entry. Never replace signed error with fake zeros. `StudentConnectedInbox` real per-learner bell and `SessionControls` preserved; switched learner never reuses another learner's data. `StudentAcademicPlanCard` moved to Training > Prepare instead of being deleted.
- CI `d2e4fa1` Verify 41286019660 green 4/4, but subsequent artwork/header/logo/docs changes need a NEW exact-head check. Actual screenshot/Dev/phone/keyboard/signed real account acceptance is pending; PR must stay Draft and Production untouched.
- **Next exact action:** verify latest PR head vs Verify run, fix failures, request Browser QA (on demand) at 360/390/768/1280/1440 and authenticated Dev preview; compare with owner screenshot before asking to merge.

## 2026-11-01 — Single Admin operations candidate #309
- After owner confirmed their signed Dev Admin worked, source branch feat/admin-consolidated-operations-20261101 wires 3 existing audited D1 workflows into existing RTL Admin pages. Preserve current read-only GET lists and bounded roles; source does NOT imply deployment.
- A new POST /v1/staff/teachers/transition resolves roster teacherId to private auth subject on the SERVER after fresh roles.manage grant, then uses existing issueTeacherRoleAction and immutable D1 role event. New migration 0027 prevents suspension/de-qualification with a future/live class at database write time. Never show the underlying auth subject in staff roster API or logs.
- /admin/schedule: assign/revoke/cancel only; booking intentionally excluded until proper trial and paid academic entitlement checks. /admin/attendance: review only with independent attendance.review D1 permission; no automatic compensation, no financial adjustments. Any network-unknown write requires SAME operationId/payload explicit replay.
- Code and acceptance: docs/ADMIN_OPERATIONS_PACKAGE_20261101.md. NEXT examine exact-head 4/4 Verify, fix typecheck/unit/native migration regressions, get independent auth/privacy review, merge only after gates; source-pinned Cloudflare staging 0027 plus signed staff/guardian/Sheikh and 360/390/1280 verification. Do not touch Production, finance or WhatsApp; #20–#36 remain open.

## 2026-11-01 — Admin consolidated read-only four-view delivery (#307)

- Baseline Noor `main@1c9791540d6bc1b6500da27d2bb613209387a8d3` verified GitHub Actions. Owner personally accessed signed Admin landing (auth grant already provisioned by DB owner) and asked to finish all at once. Do not confuse this with Production security review; staff MFA and phone verification lifecycle still pending.
- Issue #307 authorizes one safe read-only batch; additions `workers/api/src/staff-collections.ts`, `workers/api/src/auth/routes.ts`, new `apps/web/src/features/admin/{admin-collections-client.ts,AdminCollectionPanel.tsx}`, connected navigation/overview cards/CSS, focused Node/Vitest and native Better Auth D1 checks. Four fixed bounded collections: learner profiles (names but no contact), lessons, subscription cycle session credits (not payments), appeal state (no reasons/PII). Deny unverified/nonstaff before any D1 rows, all other Admin actions disabled.
- Design/authorization principle: production money and teacher role activation cannot become working by adding a button; separate D1 event contract, payment verification, consent, audit and staff reviewer gates. Admin personal account access was enabled by the owner on **Dev**; do not embed the phone or permanent D1 grants in repo.
- **NEXT:** inspect exact-head branch PR CI and native D1 smoke; repair any regressions; then independently review sensitive data scope and update signed isolated Dev Browser tests in Santoreno. Leave #307 and operational Admin backlog open until verified remote acceptance. No Production or payments deployed.

## 2026-11-01 — #305 independent continuation, admin teacher directory
- Read current main `382a2603a54fd356f106b351c621e012abc80413`, open PRs/issues/Verify before coding. `#286` P0 native D1 issue has signed synthetic Dev PASS in Santoreno run 41236448482 but remains OPEN for governance and cumulative-ink flag; do not duplicate its migration or claim Production.
- #305 branch implements bounded authenticated staff-only teacher directory, strict browser parser, RTL read-only cards, native Better Auth/D1 role-scope smoke, backend/frontend tests. Source-only until exact-head CI and signed Dev review. Parent/teacher sessions cannot see data, no financial state or activation writes.
- **NEXT exact action:** check PR #305 exact-head CI; fix any typecheck/native D1 errors; request independent review; run signed isolated Dev role and 360/390/1280 tests before merge. Do not auto-activate an admin account based on GitHub identity; require verified Noor auth subject and trusted operator bootstrap.
- No remote D1 write, media/WhatsApp/payment, Production flag, personal data, or cumulative-ink rollout.

## 2026-11-01 — Admin #302 default-off static export negative smoke
- Live `main` unchanged. PR #304 still OPEN. Added fast `scripts/smoke.mjs` check of three default-disabled /admin paths, rejects rendered staff metrics/sensitive panels in public static HTML and requires Arabic RTL. Not a signed Dev positive proof; build flags OFF.
- Expanded disposable local signed Worker smoke for stale staff cookies after D1 phone verification and account-state revocation while grant remains active. Exact-head GitHub Verify must be checked before reporting success. Revoke-grant test remains.
- Continue to independent review + gated Cloudflare Dev role and mobile QA, no Production or finance change.

## 2026-11-01 — Admin #302 role-switch hardening in PR #304
- Rechecked `main@0dee555b03f88a9d8943da17597c6980d9afedd4` and PR #304 still OPEN, mergeable, no APPROVED reviews, previous exact-head Verify PASS 4/4 on `27fad4a`. Found a source/QA gap: old staff counts could remain on an already-open tab after external D1 grant revocation or a new login with the same auth subject.
- Implemented in the same PR: AdminShell's current AccountSession **object identity** guards cached metrics; abort/clear/reload on route/account changes, visibility/focus/pageshow and cross-tab updates, plus bounded 30-second foreground recheck. Browser UI never decides roles; server still revalidates D1 every GET.
- Added native Wrangler local Better Auth smoke for real /v1/staff/overview including unsigned/nonstaff/spoof POST/CSRF, staff aggregate, D1 grant revocation, PII-scope assertions. TEMPORARY local-only flag; no Cloudflare Dev/Production toggles, finance, teachers, minors, R2 or WhatsApp.
- **NEXT:** inspect exact-head CI after these changes; if green update PR report and Issue #302. Do not merge/activate flags without independent privacy review and signed isolated Cloudflare Dev staff-vs-guardian/teacher test including role revocation plus viewport evidence.

## 2026-11-01 — Admin Phase A source start, Issue #302
- User requested continuing work and explicitly affirmed beginning a professionally organized Admin Dashboard. Checked Noor `main@0dee555b03f88a9d8943da17597c6980d9afedd4`, open PRs/CI, AGENTS/STATUS/PLAN/security/testing/ADR 0008 and existing #21/#22 blueprint. Created #302 to authorize **read-only foundation only**, documenting full Admin last.
- Implementing branch `feat/302-admin-readonly-foundation`: seven RTL routes, responsive admin layout and empty truthfully unavailable sections, signed staff-only `GET /v1/staff/overview` limited to D1 counts. Worker and Next flags OFF by default. Existing Better Auth + fresh `roles.manage` check; does not list or mutate real child/family/teacher identities. Source tests cover malformed aggregate, nonstaff denial and default-off frontend.
- **NEXT:** open linked Draft PR, inspect exact-head GitHub Verify, fix lint/TS/tests/static export if needed; independent security review and Dev account-positive/nonstaff-negative plus 360/390 checks are not complete. Keep Issue OPEN and do not deploy Production, enable finance/WhatsApp/R2, or turn on cumulative ink.
- In parallel #244 signed rebooking API Dev PASS (Santoreno #41260348906) and student/teacher synthetic browser PASS (#41259982432), but same-page cancel→auto-refresh→rebook still unproven.

## #244 signed trial availability refresh after cancellation — 2026-10-31 (candidate)
- Source branch fix/244-refresh-trial-after-cancel-20261031 based on verified main@196f3373589b04300b0c34573773c254f9197a4a. A successful owner trial cancellation previously reloaded only ConnectedClassroomLessons while StudentTrialBooking kept the previous eligible:false state and could not display rebooking slots until a manual refresh.
- ConnectedClassroomLessons.tsx now increments a dedicated availability revision AFTER confirmed cancellation, and StudentTrialBooking.tsx includes that revision in its abortable signed availability effect. SSR regression ensures the connected route never falls back to synthetic booking preview. No optimistic booking, new backend/API, finance or child data.
- NEXT: exact-head Verify and independent PR review; signed synthetic owner/learner Cloudflare Dev test: book → cancel >=6h → availability refresh without pressing Update → rebook, plus sibling/failed-cancel negative paths. Keep #244 and #155 OPEN until Dev acceptance. No Production, payment or WhatsApp changes.

## 2026-11-01 / #244 — connected student academic ledger read (candidate)
- New branch from merged main 1686f445 wires the existing signed /v1/me/learners/:id/subscription-ledger GET into /student/subscription, with strict non-bookable response parser and no cross-profile stale data. The payment section remains explicitly unavailable.
- Exact-head CI, independent review, remote 0026 D1 migration, signed owner/sibling 404 and mobile browser acceptance are NOT yet proven. No payment/production/WhatsApp/child media/feature flag changes.
- NEXT: inspect Verify and fix any failures; independently review; test signed Dev owner A, sibling B and foreign owner, including refresh/profile switch. Keep #244 OPEN.

## 2026-11-01 / #244 — compensation spend temporal guard (PR #299, CI pending)
- Source review found the 0026 compensation spend trigger checked grant issuance and remaining balance, but unlike cycle spends it did not restrict the debit timestamp to the target lesson start. A late staff ledger event could therefore consume a non-expiring grant against an already-started lesson.
- Hardened the D1 INSERT trigger to require grant-issued <= spend-at <= target lesson start; added a regression that first rejects a late debit and then accepts a timely debit 299 days after grant issuance. No credit writer or paid booking endpoint was enabled.
- Candidate commit on existing PR #299; **exact-head CI and independent SQL/security review are still required**, followed by isolated signed Dev 0026 acceptance. #244 remains OPEN; no Production, payments, child media, WhatsApp or cumulative-ink flag changes.
- NEXT: inspect exact-head GitHub Verify and independent reviewer feedback, then isolated Dev migration/owner-sibling read acceptance; do not merge solely on source tests.

## 2026-11-01 — Exact continuation: #244 subscriptions 0026 foundation, PR #299

- User asked to proceed after atomic trial replacement; #298 merged into Noor main at `157daaa0...` and isolated Dev #41254227146 showed signed 0025 replacement PASS.
- New **DRAFT** [PR #299](https://github.com/geminiamo0-ship-it/nour-elquran/pull/299) offers **source-only** 0026 D1 immutable academic-credit cycles, one-cycle carry within 3-day manual-renewal grace, non-expiring staff-issued lesson-backed compensations, spend caps, and signed guardian GET `/v1/me/learners/:id/subscription-ledger`. It always returns `bookingEnabled:false`; this does not enable paid bookings or financial receipts. Owner sibling separation via existing Better Auth and D1.
- Tests: `workers/api/tests/test_subscription_ledger.py`, `workers/api/tests/subscription-ledger.test.ts` and existing native Wrangler local all-migration gate. Read `docs/SUBSCRIPTION_LEDGER_244_FOUNDATION.md` for limitations and design. Verify latest PR-head CI; fix failures before review. Independent reviewer and signed 0026 remote Dev acceptance still needed; do not merge/deploy Production automatically.
- CRITICAL: migration only bounds period 27-32 days. The **exact Cairo calendar-month time-zone computation, pack catalog/prices, manual-confirmation staff write API, reservation/debit/refund, no-shows, late admin exceptions and full subscription UI** are NOT implemented. Separate reviewed slices required; Admin Dashboard last per owner decision.
- Next: finish PR #299 green checks, request independent SQL/security review, isolate Dev signed household GET with schema marker and no fabricated paid balances. Keep #244 open.

## 2026-10-31 / #244 — latest exact handoff: rebooked-slot safety
- Existing PR #280 `fix/244-reject-closing-booked-trial-slot-20261031`, source-only additive 0024. Native Wrangler full forward-upgrade Verify [#41242256224](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41242256224) PASS 4/4 on prior HEAD `3f0bc40a`.
- Added Python SQL regression `test_rebooked_trial_slot_still_blocks_withdrawal` at `75b92cbd`: cancelled trial A, same-slot rebooking B, withdrawal denied while B scheduled, no closure event, then cancel B and allow withdrawal. **Check new exact-head Verify before claiming PASS.**
- Earlier #286 P0 remote blocker is now technically cleared on isolated Cloudflare Dev by signed Santoreno [run #41236448482](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41236448482) (both jobs SUCCESS, migration 0023, Sheikh pen+highlight save/replay→publish→owner readback, sibling denial). Independent post-merge security review remains a separate governance gap; do not enable `NOOR_CUMULATIVE_INK_ENABLED`.
- NEXT: inspect exact-head PR #280 CI, independent review of 0024 and existing 0023 governance, then controlled signed Dev staff/owner 0024 forward migration and withdrawal acceptance. Leave PR Draft, #244 OPEN; no Production/payment/voice/WhatsApp.

## 2026-10-31 — #244 native D1 forward-upgrade trial slot protection (PR #280; candidate)
- Source branch `fix/244-reject-closing-booked-trial-slot-20261031` now fixes a smoke-test sequencing bug: previous legacy 0022 setup accidentally included future 0024. Native Wrangler local state is migrated 0022→0023→0024 in order, with a synthetic real booked trial seeded between 0023 and 0024.
- New `scripts/fixtures/trial-slot-native-pre0024.sql`; native checks require `TRIAL_SLOT_ALREADY_BOOKED`, unchanged scheduled lesson and no closure event on failed withdrawal; a genuine owner cancellation event then permits staff closure with FK integrity. No remote resources, secrets or real children used.
- Exact-head CI on this addition is **not yet accepted**. Read latest PR #280 HEAD and Verify before any PASS claim. #280 Draft, #244 OPEN. #286 signed Dev 503 acceptance and independent security review are blockers for remote migration 0024; no Production or feature flags changed.
- NEXT EXACT ACTION: inspect PR #280 Verify; fix any native D1 fixture/SQL failures. Then independent reviewer and controlled signed Cloudflare Dev tests, never self-approve or close #244 based on local-only checks.

## 2026-10-31 / #244 — combined migration sequence candidate on main
- Noor #288 merged 0023; this branch is synchronized with that main commit and proposes only additive 0024 booked-trial slot closure guard. #286 was reopened because the signed remote Dev 503 fix is still unverified.
- Run full migrations in numeric order with synthetic data, then test the booked-slot withdrawal denial and post-cancellation success. Source CI is not a remote Cloudflare Dev migration. Obtain independent review and signed staff/owner Dev acceptance before merge. No Production, audio, payments, WhatsApp or cumulative-ink flag changes.

## 2026-11-01 / #244 — PR #298 migration sequencing candidate (not merged)
- Detected duplicate D1 `0024` names in open PR #280 (booked-slot withdrawal guard) and PR #298 (atomic trial rescheduling). PR #298 reserves **0025** instead, with an explicit dependency on independent review/merge and isolated Dev acceptance of #280's 0024. No migration was applied remotely.
- Corrected native Wrangler pre-0023 upgrade fixture to exclude **all** future numbered migrations (not just 0023), so a populated historical DB cannot accidentally be seeded with 0024/0025. Full fresh-schema local smoke still applies available migrations in filename order.
- Required before merge: exact-head GitHub Verify including native D1, independent SQL/security review, and signed isolated Dev owner/Sheikh E2E with 0023→0024→0025 migration order. Do not merge/deploy 0025 ahead of 0024; #244 remains OPEN. Production, payment, WhatsApp, child media and cumulative ink flag unchanged.

## #286 P0 — 0023 forward migration on existing data (2026-10-31)
- New test `workers/api/tests/test_ink_d1_forward_upgrade.py` (source commit `b2ccac2f`) verifies **pre-0023 populated schema → forward migration 0023 → existing draft retained → Sheikh marked revision 2 → publish→canonical 2 marks**, with zero sibling leakage and valid foreign keys. In-memory SQLite tests upgrade/data preservation; existing Wrangler native D1 smoke separately proves D1-specific GLOB compatibility. No remote Cloudflare Dev test yet.
- Verify [#41200670244](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41200670244) queued at initial check; inspect exact latest PR-head status before any pass claim. PR #288 remains Draft and #286 OPEN. NEXT: resolve CI, obtain independent review, then isolated Dev migration 0023 and signed Sheikh save/replay→publish→owner cumulative readback plus sibling denial. Never enable flag or touch Production until separate E2E acceptance.

## 2026-10-31 #286 P0 — unassigned sibling draft denial native D1 candidate
- PR #288 branch `test/286-native-d1-ink-draft-repro`: new synthetic negative fixture attempts a Sheikh highlight draft for an unassigned sibling under the same owner. `scripts/cloudflare-local-smoke.sh` requires `DRAFT_ACCESS_DENIED`, no draft row and no sibling canonical event/current mark. Commits `5a1e1c1b` and `2b683710`; exact-head CI pending at handoff.
- NEXT EXACT ACTION: inspect Verify on current PR head; if green, obtain independent review and apply migration 0023 only on approved isolated Dev, rerun signed two-role teacher draft save/replay→publish→owner Quran readback with sibling denial. No Production/paid/media/WhatsApp changes; `NOOR_CUMULATIVE_INK_ENABLED` OFF; do not close #286 on local tests alone.

## Next action — #286 P0 native D1 sibling isolation regression (2026-10-31)
- PR #288 branch `test/286-native-d1-ink-draft-repro` now includes synthetic same-account sibling in the native Wrangler D1 draft fixture; publication of one learner's Sheikh pen+highlight marks must leave the sibling's canonical event/current tables empty. Local smoke checks `NATIVE_DRAFT_SIBLING_ISOLATED_OK`. Commits `2b669476` and `8c0d849e` are source changes; CI on final head is not yet accepted.
- Prior exact-head Verify [41188758711](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41188758711) passed 4/4 for `552bddae`, not the sibling addition.
- NEXT: inspect new exact PR-head Verify and fix failures; obtain independent review; only then apply forward-only migration 0023 on approved isolated Cloudflare Dev and rerun signed Sheikh draft save/replay→publish→owner cumulative readback plus sibling denial. Do not merge or close #286 on local CI alone. Keep `NOOR_CUMULATIVE_INK_ENABLED` OFF, Production untouched.

## #286 P0 — native draft privacy gate follow-up (2026-10-31)
- PR #288 branch `test/286-native-d1-ink-draft-repro` now checks that a private synthetic Sheikh pen/highlight draft has no canonical learner event or projection **before** publication; after publish the native D1 fixture checks both teacher-authored kinds and assignment provenance. Source commits: `3138376a`, `327645e4`; status update `92043ef1`.
- NEXT EXACT ACTION: inspect **latest exact-head** GitHub Verify on PR #288 and fix any failures. Then independent review; only afterward run approved isolated Dev migration 0023 and signed Sheikh draft save/replay→publish→owner cumulative readback, plus sibling denial. Existing remote 503 is **not proven fixed**. Keep #286/#284 OPEN, Draft PR, `NOOR_CUMULATIVE_INK_ENABLED` OFF. No Production, real learner data, voice, payments or WhatsApp.

## 2026-10-31 / #286 — missing JSON fields SQL NULL bypass, source candidate
- On existing Draft PR #288 branch `test/286-native-d1-ink-draft-repro`, found SQLite three-valued-logic bypass: missing `$.payload.color` made both `json_type <> 'text'` and hex checks NULL, so draft validation did not reject on color alone. Related missing required mark/point fields also needed explicit fail-closed handling.
- Candidate migration 0023 now wraps required `json_type` expressions in `COALESCE(...,'<missing>')`, including canonical ledger point coordinates. Added Python missing-field cases and disposable native Wrangler missing-color fixture with no-persist assertion. Check exact PR HEAD Verify before asserting any pass; run signed synthetic Dev Sheikh save/replay→publish→owner cumulative readback and sibling denial after reviewed merge/migration. Keep #286/#284 OPEN and `NOOR_CUMULATIVE_INK_ENABLED` OFF; no Production/real child media.

## 2026-10-31 / #286 — native canonical-ink invalid-color regression (candidate)
- Extended Draft PR #288 with a **second** native Wrangler D1 negative fixture: a synthetic learner self-study pen event with malformed `#gg0000` must fail `QURAN_LEDGER_PAYLOAD_DENIED` and leave **neither** a canonical event nor a projected current item. The earlier teacher-draft invalid-color check and positive draft→publication→canonical projection remain.
- This commit is **pending exact-head CI**; prior verified head `110400fc` passed [Verify #41177632597](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41177632597) 4/4. No signed remote Cloudflare Dev success, migration 0023 deployment, PR merge or Production claim. Keep #286 OPEN, cumulative ink flag OFF.
- Next: inspect exact new-head CI, obtain independent review, then apply migration 0023 **only in approved isolated Dev** and run signed Sheikh draft save/replay→publish→owner cumulative readback and sibling denial. No real child data, R2 audio or payment changes.

## 2026-10-31 / #286 — native D1 negative-color regression candidate (exact-head CI pending)
- Extended Draft PR #288 native Wrangler D1 smoke with a separate deliberately failing synthetic teacher highlight INSERT (#gg0000). The gate now requires DRAFT_MARKS_INVALID and verifies the invalid draft was not persisted, in addition to the previously green private pen+highlight save → publication → canonical projection path.
- This is an additional **unverified candidate** until the new exact-head Verify completes; it is NOT signed Cloudflare Dev acceptance. Keep #286 OPEN and cumulative live ink OFF. Next: inspect exact-head CI, independent PR review, then isolated Dev migration 0023 and signed Sheikh replay/publish/owner readback with sibling isolation. No Production or real child data.

## 2026-10-31 / #286 — native D1 P0 color GLOB fix candidate (PR #288; Dev pending)
- Verified Noor main `96e9c76bd5ba8bc8022d666a1af6705da8e5ba19`; Santoreno Dev run [#41170640624](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41170640624) still fails signed teacher marked-homework POST 503 `DRAFT_STORAGE_UNAVAILABLE / D1_UNKNOWN`. Previous #287 only classified failure; no publication or owner Quran readback succeeded.
- **Root cause reproduced:** [Verify #41172923949](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41172923949) failed the new exact-shape synthetic native Wrangler D1 test at first INSERT: `LIKE or GLOB pattern too complex: SQLITE_ERROR`. This is the six-repeated-hex-class color GLOB in migration 0018 (also present in canonical guard 0017); Python SQLite fixtures had not caught Cloudflare's native limit.
- Draft [PR #288](https://github.com/geminiamo0-ship-it/nour-elquran/pull/288) now adds forward-only migration 0023 recreating both triggers with exact-length, `#` prefix and short nonhex GLOB validation, and native D1 private save→publish→canonical projection regression. Original migrations remain untouched. **Candidate source fix: exact-head [Verify #41173078798](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41173078798) PASSED 4/4, including native D1 private draft write and publication→canonical readback. Signed Cloudflare Dev E2E still pending.** No remote D1, secrets, real learners, Production or flags changed.
- NEXT: review PR #288, then run isolated Cloudflare Dev signed Sheikh save→replay→publish→owner cumulative readback and sibling isolation. Keep #286 OPEN and `NOOR_CUMULATIVE_INK_ENABLED` OFF.

## #252 classroom snapshot ACK safety — 2026-10-31 (branch candidate)
- Branch `fix/252-ink-snapshot-ack-semantics-20261031`: `LessonRoom` no longer calls an ink snapshot `saved` merely because `pendingQuranInk` is empty; old DO-only strokes can exist without any canonical ledger event. A pending outbox still reports `pending`. Write ACK behavior is unchanged.
- Tests in `classroom-cumulative-delivery.test.ts` cover pending outage snapshot and pre-bridge DO stroke before/after enabling the gated bridge; D1 event count remains zero for the latter.
- NEXT: inspect exact branch-head Verify (four jobs), resolve any failure, request independent PR review. Do not merge or enable `NOOR_CUMULATIVE_INK_ENABLED` without signed two-role Dev, historical reconciliation and owner approval. #252 remains OPEN.

## 2026-10-31 Signed Student & Sheikh portal Dev acceptance — PASS (scope limited)

## CURRENT NEW PRODUCT APPROVAL — 2026-10-31 / ADR 0009 / #250
The owner confirmed **ONE cumulative per-learner Mushaf** shared by every Quran view. Authorized Sheikh AND learner session ink/marks/notes persist and appear globally after successful durable ACK, **not gated on lesson report publication**. Teacher homework note/ink drafts remain hidden until task publish, then appear on all page views. Learner-private marks are visible in the composite student reader but not exposed to Sheikh without explicit sharing. Notebook is as-of filtered historical rendering of same canonical ledger, not duplicated pages. Existing private_mushaf D1, teacher-only Classroom DO ink, and read-only lesson archives are NOT yet unified. Implement #251 → #252 → #253, with strict multi-sibling/role, idempotency and restart tests. Source of truth: docs/adr/0009-unified-cumulative-learner-mushaf.md. Existing #155 and #242 stay OPEN. Do not infer backend completion.

 Noor code PR #243 merged main at 604ce1103e824fddb52f16b6621ec04266fbb6da; exact postmerge Verify #41142697961 succeeded 4/4.
- Santoreno QA PR #298 merged as f6eb3f3ae3dfbfa91f098667e78d9f1d4675eada. Full isolated Dev run: https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41143167533 — SUCCESS.
- Actual synthetic browser: anonymous Sheikh receives login, NO fixtures; authorized Sheikh D1 roster/plan and connected preparation; teacher notifications/cases truthful unavailable, staff/unauthorized actor denied; student home/lessons/subscription reflect signed APIs, no fabricated grades or finance state, sibling edit/archive persists, foreign owner 404; responsive RTL 360/390/768/1280/1440 with screenshot artifact noor-profile-remote-browser. Core Dev signed lesson/LiveKit/security smoke also succeeded; Production untouched.
- This confirms the no-fixture boundary and connected existing features, NOT end-to-end completeness of missing business workflows. Master #155 and owner portal audit #242 remain OPEN; #244 genuine booking/entitlements, #245 R2 voice, #246 attendance, #247 notifications, #248 sealed Quran exports are NOT implemented. Never portray empty/disabled interfaces as delivered, no provider payments or automatic WhatsApp claimed.
- Next: close each blocker with signed Worker/D1/R2 and cross-role Dev tests. After all integrations, run full owner visual mobile/desktop acceptance; do not unnecessarily rerun expensive Chrome for docs-only changes.

## Current handoff: Classroom Dev final E2E PASS — 2026-10-31 / #240
Classroom Dev accepted in the single synthetic run: https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41140055151
App commit: 57c59518a544672fa4c213d81b0e49208f5b2b70; test harness: 5875cc18344cc8871102499945ad8dd2cc3fc0f5.
Verified real signed dual-browser synthetic LiveKit, teacher mic mute/release and learner opt-in, Quran page+ayah sync, ink/eraser and reconnect, mobile screenshots, signed Start/End D1 audit, private correction to report draft, explicit publish and the same approved report after teacher revocation.
6236 pinned Hafs anchors verified. Automated isolated Dev PASS, not human visual acceptance or Production certification; no production data/media was modified.
Tracked feature Issues #231 #232 #235 #236 remain open until owner personal visual QA. Browser screenshots are in noor-profile-remote-browser artifact of the final staging run.
Earlier blockers were fixed by Noor PR #239 (canonical D1 lookup instead of HTTP 503) and Santoreno PR #296 (report revision 2->3: compare exact approved snapshot).
No further source fix needed to explain prior suite errors. Owner's remaining job: look at staging UI on actual teacher and student devices; check responsive Surah/Ayah controls, teacher moderation and report workflow. Keep production media off and do not expose credentials. Then continue portal closure #155.

## Dev Quran shared verse 503 remediation — #238 (2026-10-31)
- Single combined staging run [Santoreno #41137769340](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41137769340) successfully deployed Noor main and passed real two-browser LiveKit synthetic A/V, Sheikh mute/release+student opt-in, shared Quran pagination/ink/eraser, phone viewports and reconnect. Failed *after* those at first signed POST Quran selected Ayah (HTTP 503). Do NOT claim completed lifecycle/report yet.
- Fix candidate #238 changes server-side verse-to-page proof from cross-Worker HTTP fetch to the already audited D1 `quran_ayah_anchors` exact `(edition,surah,ayah,page)` row. Edition `hafs-kfqc:v1.1.1`, manifest pinned `864c5474872876b3db8a328d8c74781be83c004a7cdb168ffb4b7eb57477edd2` and 6236 anchors independently reconciled by staging. Wrong page/edition/missing D1 fail closed. No new Quran data or external media and no changes to browser rendering.
- Retest integrated source Verify and then repeat same Dev synthetic complete classroom Start→Ayah→correction→End→report QA; Production remains untouched.

## Owner 2026-10-31 single-suite classroom continuation #235/#236
- Existing #233 Sheikh mute/unmute Draft Verify #41132499065 PASS 4/4; #234 signed Ayah Surah navigation Draft Verify #41135034286 PASS 4/4 (until changes). New branch `feat/235-real-lesson-start-end` is stacked on #234 and includes #233; use a single integration PR against main and DO NOT blindly merge overlapping branches twice.
- New `lesson-lifecycle-write.ts`: signed Sheikh Start after real teacher heartbeat and both leases, D1 atomic batch + immutable append-only event; explicit End no automatic timer, DO media wake; GET lifecycle for teacher/owner and report deep link. `live-corrections.ts`: typed persistent Sheikh-only notes; DO current selected Ayah proof; appended log with bounded text and operation ID. End attempts private prefill of existing report draft; Sheikh grades/publishes manually. Source test files and routes added.
- NEXT EXACT ACTION: execute single latest exact-head GitHub Verify, fix any failures, review code and staging workflow, then only merge/deploy after warranted Dev acceptance. Need real LiveKit two-device runtime verification: moderation, rejoin, page/ayah highlight, ink, notes, End, private draft and manual report publishing. No Production, no child recordings, no artificial attendance. Existing report UI is real but cannot be called auto-published.

## HANDOFF 2026-10-30 — #231 / #232 Classroom source candidates
- Draft PR #233 https://github.com/geminiamo0-ship-it/nour-elquran/pull/233: teacher mic mute/release and DO policy; 4/4 source Verify #41132499065. Teacher release removes moderator lock; only learner may switch own device on, no remote unmute setting.
- Draft PR #234 https://github.com/geminiamo0-ship-it/nour-elquran/pull/234 branch feat/231-signed-quran-verse-navigation: exact canonical surah/ayah browser lookup, Worker verified selected Ayah on page, signed LessonDO page+verse state with CAS and student overlay. 4/4 source Verify #41134677808 before doc updates. Its main-target integration diff includes #233 commits; split histories safely when #233 merges.
- NEXT: check exact new HEAD Verify, do authenticated real two-device Dev staging visual + LiveKit tests and do not claim source checks prove deployment; reconcile PR bases, merge only after acceptance and verify post-merge. Keep #231 and #232 OPEN, production media OFF, signed formal Start/End pending separate implementation.

## Latest CR-02B2 #206 write-time wake + mute Dev proof (2026-10-30)
- Noor #209 squash `812525274ceb549797f8ab821a38804839c81c04`, main #41002079116 PASS 4/4. Santoreno #269 squash `c55b621499a0901a67cdec3c65245a7254c697ea`, real isolated no-secret Dev #41002323938 PASS: signed acting Sheikh mic mute 503 no provider, forged unmute/track 400, learner 404, anonymous 401, GET 405; CR-01/CR-02A/07A/08A/08B1 PASS. Read `docs/CLASSROOM_CR02B2_WRITE_MUTE_DEV_ACCEPTANCE.md`. Do not claim real provider effects/instant eviction. Next user-owned LiveKit Cloud Dev project and secrets securely in Worker, two-device provider moderation/eviction/reconnect; separately teacher-signed Start/End lifecycle + real Quran syncing; issue #206 stays OPEN, Admin LAST.

## Current CR-02B2 #206 direct staff wake + teacher mute branch
- `feat/206-livekit-writetime-mute`: check `workers/api/src/classroom/media-enforcement.ts`, `livekit-mute.ts`, internal DO `/internal/reconcile-media`, route staff suspension/cancellation and signed Sheikh `mute-learner-microphone`, browser `LiveLessonMedia` Sheikh button. Unit tests `livekit-mute.test.ts`, `classroom-write-enforcement.test.ts`. Source-only until exact-head Verify, isolated Dev 503/no-secret gate, actual provider ACK with user-owned keys and two devices. **No signed classroom End API exists to hook yet**; DO alarm detects D1 terminal state but not instantaneous. `docs/CLASSROOM_CR02B2_WRITE_MUTE_CONTRACT.md` is the acceptance scope. Never enable Production or claim provider validation; Admin LAST.

## CR-02B2 #206 first source slice merged; provider-side acceptance NOT complete
- Noor #207 squash `6a490efea53fec243facf09b5e5489910cd48b3b`, main Verify #40999944470 SUCCESS 4/4. Detailed `docs/CLASSROOM_CR02B2_SOURCE_ACCEPTANCE.md`. Santoreno #267 merged `0844710c1898bd15dc06fbd6394adbc6f9486cf9`; remote isolated Dev [run #41000153415](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41000153415) **SUCCESS**: public media-intent 400, signed media-token 503/no token without provider keys, CR-01/07A/08A/08B1 regressions PASS. This did NOT call the LiveKit provider. Core: DO media-intent durable alarm, D1 authorization check and queued LiveKit participant removal. Real provider credentials and ACK, immediate revocation-write hooks, teacher mute-only and real two-device media test still REQUIRED; keep #206 open and Production OFF. Admin last.

## CR-02B2 #206 currently in source Verify
- Branch `feat/206-livekit-authoritative-eviction`: check `workers/api/src/classroom/livekit-admin.ts`, `lesson-room.ts`, `livekit-token.ts`, new `classroom-eviction.test.ts` and `livekit-admin.test.ts`, and `docs/CLASSROOM_CR02B2_PROVIDER_EVICTION_CONTRACT.md`. Source uses actor-bound DO media-intent, alarm/D1 rights rechecks and durable removal outbox, provider Twirp server-only admin JWT with explicit cutoff. No LiveKit credentials present, no actual provider ACK or connected client eviction. Need exact GitHub Verify; then isolated Dev no-secret and source QA, and direct D1 revocation-write hooks + teacher mute, and real LiveKit two-device verification. Keep #206 open; Admin last.

## Latest coding slice CR-02B1 #204 — media SDK client, no external room test
- Read `docs/CLASSROOM_CR02B1_MEDIA_CLIENT_CONTRACT.md`, `apps/web/src/features/classroom/LiveLessonMedia.tsx`, `media-credentials.ts`, `ConnectedWaitingRoom.tsx`, pinned SDK dependency + pnpm-lock.yaml, Vitest tests. Source on `feat/204-livekit-browser-media`, token gateway main from #200 already Dev-accepted **without secrets only**. Run exact-head GitHub Verify before merge. No provider A/V, actual device/browser, permission/guardian consent test or Production. CR-02B2 provider removal of connected revoked participants is **mandatory** before any real user rollout; 120s JWT not eviction. Next connect with user-owned LiveKit Dev secrets only after revocation, then two-device QA. Admin Dashboard last.

## Current source+Dev accepted boundary — CR-02A LiveKit token gateway (2026-10-30)
- Noor PR #201 merged `d231568d84748d5a16f0b496fbb0dad76898a084`, main Verify #40996405754 PASS 4/4. Santoreno PR #265 merged `6f98b8e0acf063608d156e3d4cff56225de6574a`; real isolated Dev #40996681563 PASS: two authorized synthetic session clients joined LessonDO, media-token POST **503/no token** because LiveKit credentials deliberately absent, forged room/role body 400, foreign 404, anonymous 401 and GET 405; existing regressions PASS. Read `docs/CLASSROOM_LIVEKIT_CR02A_DEV_ACCEPTANCE.md`. No external media room/A/V or device approval. Next: CR-02B LiveKit client tracks + actual provider-side revocation of connected participant on loss of access, then real device media proof using user-owned LiveKit Cloud credentials securely injected to Cloudflare Dev only. Do not claim completed AV. Admin last.

## CR-02A current coding slice: source-only signed LiveKit Cloud token gateway (#200)
- Follow `docs/CLASSROOM_LIVEKIT_CR02A_TOKEN_CONTRACT.md`: pure WebCrypto HMAC JWT and signed teacher/household owner POST endpoints, D1 role and 25s LessonDO heartbeat gate. No real LiveKit credentials, project provisioning, A/V devices or external room tests; missing configuration must fail closed. Next gate exact-head Verify (typecheck/unit/build/local D1), inspect JWT/credential privacy, then merge and optional Dev 503/no-token acceptance. CR-02B needs user-owned Cloudflare secrets + LiveKit project and two actual browsers, a revocation mechanism to eject connected users, and no recording. Do not claim provider operational; Admin dashboard still last.

## Latest verified CR-01 handoff (2026-10-30)
- Signed DO waiting-room PR #197 merged, Noor main Verify #40993668189 4/4 PASS. Santoreno real Dev #40994099005 PASS on two Better Auth synthetic sessions, 25s expiry and foreign/anonymous denial; no false attendance. Evidence: `docs/CLASSROOM_CR01_DEV_ACCEPTANCE.md`. Follow-up PR #199 fixes React StrictMode callback rearm; exact-head Verify & merge still required. No LiveKit Cloud tokens, camera/mic, real shared Quran, Classroom Start/End or Production. Next technical delivery: CORE #49 LiveKit per-lesson scoped token gateway after consent/device permission and live two-client proof; CORE #50 DO Quran sync & teacher-authorized Start/End; #194 trusted archive producer. No global Chrome default; Admin last.

## Current work — CR-01 signed DO Classroom waiting room (#196)
- Branch `feat/196-classroom-waiting-room-do`: read `docs/CLASSROOM_WAITING_ROOM_CR01_CONTRACT.md`, `workers/api/src/classroom/lesson-room.ts`, `presence.ts`, auth routes and `ConnectedWaitingRoom.tsx`. First run source exact-head Verify and fix any failure. Current Wrangler DO config is **local API Worker only**, actual Noor Dev site deployment requires dedicated Santoreno DO binding/migration review, and Dev two-account join/expiry/revoke proof. No false real-room, attendance, LiveKit, Quran sync or Production assertions.
- Owner approved LiveKit Cloud for A/V only (ADR 0007); Cloudflare Workers/D1/DO own lesson state and Quran. Next after waiting-room acceptance: limited signed LiveKit join tokens + true device test, then DO Quran page/ink and explicit authenticated lifecycle Start/End → archive #194. Admin Dashboard last.

## 08B1 handoff: owner archive GET Dev PASS; no live DO source
- See `docs/PHASE_08B1_DEV_ACCEPTANCE.md`: Noor main Verify #40990456089 and Santoreno remote Dev #40990589139 PASS. Sealed-snapshot owner reader is implemented, but all real archives are intentionally absent until the trusted Classroom DO writer (#194). Do not claim actual teacher marks/PDF, visual QA or Production. Admin Dashboard remains last.

## Next Phase 08B1 #192: secure Quran archive reader (source only)
- Read `docs/LESSON_QURAN_ARCHIVE_08B1_CONTRACT.md`, migration 0015, `workers/api/src/lesson-quran-archive.ts` + auth route, shared lesson archive typed client/reader, SQLite and Vitest tests; branch `feat/192-lesson-quran-archive-read`. Fast Verify exact head + D1 tests first, then merge/postmerge Verify and isolated Dev owner-only GET/404 with synthetic sealed schema fixture. No automatic Chrome.
- Only real Classroom DO snapshot exporter may eventually write+seal data with independently verified source digest and END/participant authorization; **this slice has no writer**. Never claim live archived marks exist on the service until that source is built. Report #186 and notebook #190 API Dev smoke already passed; keep UI and real classroom gates open. No Production, no Admin until final phase.

## Active Phase 08A #190 next steps (source only)
- Review `docs/NOTEBOOK_PHASE_08A_CONTRACT.md`, Migration 0014, `workers/api/src/notebook-notes.ts` authenticated routes, and `ConnectedNotebookWorkspace.tsx`. Run exact-head Verify, fix real TypeScript/SQLite faults, then stage isolated D1 0014 and signed owner/foreign per-lesson note E2E on Dev. Do not mark API ready before remote acceptance or run Chrome by default.
- Phase 07A report API is Dev accepted: Noor main Verify #40986308630 and Santoreno remote #40986426733. UI owner visual QA/real Classroom remain open, not blocking development of owner-private free-text notebook. Admin is last.
- No private Quran layer duplication. Real Classroom/DO snapshots, archive PNG/PDF, sharing and notifications are separate future work.

## Next action after Phase 07A isolated Dev PASS (2026-10-30)
- Current main `fedc03a8aa89e04a8080e5210840a93bf900027c`, [Verify #40986308630](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40986308630) 4/4 successful; isolated [Santoreno staging #40986426733](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40986426733) SUCCESS, confirms remote D1 migration 0013 and signed staff/Sheikh/owner report POST/GET with isolated synthetic END. Keep #186 open until UI acceptance.
- **Next exact task:** one targeted connected Sheikh Reports / Student Progress visual QA using synthetic staging accounts (360x667,390x844,1280x900), only on demand; verify draft save ACK/loading/error, latest published owner-visible, sibling switch, keyboard/RTL, no fixture fallback. Then Phase 07B notebook actual published lesson link, private notes, and archived Quran layers once Classroom event snapshot contract is verified. Do not automatically Chrome every commit.
- Real Classroom END, lesson snapshot/PDF and notifications are independent later gates. Admin Dashboard/teacher invites/booking/subscriptions still final product program, no duplicate financial backend. No Production/real child data.

## Immediate handoff — Phase 07A #186 / Admin-last boundary (2026-10-30)
- On branch `feat/186-lesson-reports-d1`, review `docs/LESSON_REPORTS_PHASE_07A_CONTRACT.md`, migration 0013, `lesson-reports.ts`, authenticated routes and connected TeacherReports/Student Progress. First make exact-head Verify pass; do NOT merge/source-claim if failing. Then isolated Dev D1 migrate and synthetic authenticated END→draft→publish→owner read→second draft/old visible→republish+actor 404. Browser QA only when visually needed. No real students and no Production.
- Admin Dashboard is final separate program; teacher invite-only registration/professional profile/photo creates pending application, activated only by staff, with student assignment separate (ADR 0008). No payment, booking or staff activation UI in the current portal work.
- #186, #51, #155 remain OPEN until real Dev and UI proof. Classroom END and archive still separate. Do not invent a lesson event to make reporting pass.

## Latest verified handoff — Phase 06A1 Dev privacy boundary (2026-10-30)
- Source [Noor #182](https://github.com/geminiamo0-ship-it/nour-elquran/issues/182), [PR #183](https://github.com/geminiamo0-ship-it/nour-elquran/pull/183) and runtime hardening [PR #184](https://github.com/geminiamo0-ship-it/nour-elquran/pull/184) merged and postmerge CI passed. Verified real isolated Noor Dev: [Santoreno staging #40979386785](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40979386785), [Santoreno #254](https://github.com/geminiamo0-ship-it/santoreno/issues/254) CLOSED. D1 migration 0012 locked, synthetic owner/siblings 200 disabled, foreign owner 404, anonymous 401, grant POST 405; zero asset metadata. Other assignment 05A/05B regressions passed.
- No recordings are stored; **do not enable** audio, consent grant, R2, or child voice. Noor [#180](https://github.com/geminiamo0-ship-it/nour-elquran/issues/180) stays open for verified guardian/age, explicitly approved consent disclosures + retention/delete/export, private bucket and binary upload/playback ACL/lifecycle tests. Exact next engineering work can prepare those non-live contracts without making up policies; real uploads cannot ship until approvals.
- The owner handles 05A/05B **visual** acceptance #173/#178; don't auto-run Chrome or pretend visual signoff.

## Next handoff — #180 fail-closed media boundary (2026-10-30)
- Draft branch `fix/180-private-audio-runtime-guards` adds runtime revalidation in `privateRecitationObjectKey` and `privateRecitationResponseHeaders`, with adversarial Node tests. Scope is only the disabled server-side helper and tests; **no audio pipeline is enabled**.
- Next: inspect exact branch-head Verify and review, then merge only after required gates and record postmerge CI. Parent #180 cannot be completed without owner-approved guardian identity, consent, retention/deletion/export and private R2 security/Dev acceptance. Do not ask the owner to repeat unchanged policy decisions every run; independent backlog remains available.

## Current work — private recitation groundwork #182 (2026-10-30)
- Owner explicitly owns remaining assignment/review **visual** QA (#173/#178); development need not block on screenshots. Do not declare their visual acceptance yourself.
- New source scope is [Phase 06A1 #182](https://github.com/geminiamo0-ship-it/nour-elquran/issues/182): locked D1 consent/audio metadata, opaque media envelope, owner-only disabled capability read; [contract](PRIVATE_RECITATION_AUDIO_CONTRACT.md). Absolutely no real-child voice upload, public R2 links, approved guardian proof or retention. Parent #180 remains open.
- **Next exact work after CI**: validate migration on isolated native D1; verify signed owner A vs foreign owner 404 and POST 405 under Better Auth; integrate only after isolated Dev proof. Next engineering phase requires explicit consent verification and retention/deletion approvals before private R2 writes/playback can be enabled.

## Current handoff — Phase 05A/05B remote-verified APIs (2026-10-30)
- Noor `main@b0b03c2278325cc63de2b38770cc4eb05781ca46`, PR #179 merged; postmerge [Verify #40974982514](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40974982514) 4/4 passed.
- Real isolated Cloudflare Dev published-homework contract [Santoreno #40971275548](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40971275548) passed. Real submission/review contract [Santoreno #40975149637](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40975149637) passed: student owner authenticated POST, replay 200, 409 duplicates, Sheikh active GET/retry/replay, second student attempt, teacher accepted, immutable GET history, revoked teacher 404 and synthetic privilege cleanup.
- Remaining for #173/#178: **one targeted visual/interaction QA on actual student homework + teacher review screens**, mobile 360/390 and desktop, correct signed-in/no-fixture state; only run Chrome manually on demand and preserve screenshots. Do not claim visual acceptance from green API CI.
- Next approved logical stage #180 (Phase 06) is strictly private R2 audio with consent, verified guardian/phone rules, documented retention/delete/export, object authorization and no public asset URLs. **No voice submission/upload enabled now**. Do not touch Classroom, Santo, Production, real children or payment.
- Below prior draft/status headings are chronology, not current completion state.

## Active next slice #178 — student submitted attempts and teacher review
- Source branch `feat/178-assignment-submission-review`, parent #155. Migration 0011: immutable `assignment_submission_events` and `assignment_review_events` with server timestamp and current teacher/owner ACL triggers; retries only after a teacher's `retry_requested`, maximum five. Better Auth worker GET/POST `/v1/me/learners/:learner/assignments/:task/submissions`, GET/POST `/v1/teacher/learners/:learner/assignments/:task/reviews`; typed clients; student per-task explicit Submit; teacher on-demand review, accept/retry. No invented teacher scores or recording upload.
- Gate: exact-head Verify, real Worker+D1 submit/review idempotency/race tests, postmerge Verify, Santoreno Dev synthetic role matrix and one **targeted** UI acceptance before closing #178. Production and R2 unchanged. No Chrome on every commit.
- Parent #173 backend Dev proof [Santoreno #40971275548](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40971275548) PASSED; targeted visual assignment UI check still open. Phase 06 audio requires guardian consent, approved retention/deletion/export, private R2, quotas and access controls before enabling.

## Phase 05A #173 current source handoff
- Branch `feat/173-published-assignments-main` supersedes conflicting draft branch `feat/173-published-assignments` after Noor teacher static route #169 merged. Worker `published-assignments.ts`, migration 0010, shared client and Student Training/Teacher Assignments UI are source-only.
- Next fast Verify must cover sqlite native migration/Better Auth teacher publish + owner read, no automatic Chrome. After merge and success, targeted Dev publish/reload/role checks; audio uploads and grading are separate Phase 05B/06. Keep #173 open until remote acceptance.

## Active blocker #169 — connected teacher route trailing slash
- The scoped Dev build and D1/owner lifecycle checks succeeded, but the targeted teacher browser screenshot in Santoreno run 40968034708 showed generic "هذا القسم قيد ربط الـBackend" with banner "بوابة الشيخ المتصلة". Root cause: static URL `/teacher/students/` vs strict unsuffixed check in `TeacherReadOnlyView`.
- On branch `fix/169-teacher-static-trailing-slash`, normalization plus unit test covers Students, Schedule, Assignments, root and preservation of non-teacher paths. Validate PR CI, merge, postmerge Verify and rerun existing Santoreno #248 via workflow dispatch (not default Chrome). Do not claim remote teacher UI ready until actual screenshot and role denial pass.

## #171 fast default CI / on-demand browser QA
- Owner preference (2026-10-30): prioritize quick CI; Chrome full E2E should NOT run with every PR/main push. Branch `chore/171-fast-ci-browser-on-demand` keeps core lint, typecheck, unit/integration, build, HTTP plus native local Wrangler D1 and Better Auth session/ownership smoke in Verify.
- Manual `.github/workflows/browser-qa.yml` choice static/account/all covers the exact local synthetic Chrome journeys and screenshots when needed for material UI/role work or pre-release. Staging remote browser is an independent explicitly invoked acceptance step; do not conflate green Verify with UI acceptance.
- Pending: new workflow YAML/policy tests, exact-head Verify, issue #171 PR and postmerge check. No production deploy. Teacher connected Dev rollout #169/#248 is independent and must still satisfy its authorized role requirements.

## #169 Noor teacher session-aware public preview + real mode (draft)
- New role boundary `resolveTeacherPortalMode`: when opt-in build flag true, authenticated sessions show real teacher read adapter (D1 verifies role); signed-out visitors see clearly identified demo; while session checking/error show no fixtures. Role denial 403 never falls back to demo.
- No change to connected API, D1, lesson DO or payments. Feature flag stays off by default until dedicated Noor Stage build enables `NEXT_PUBLIC_TEACHER_READONLY_ENABLED=true` and role-provisioned browser acceptance. Existing public preview must remain reachable to visitors.
- Exact-head CI and remote Dev evidence are next; do not close #169 from module tests alone.

## #167 connected teacher Students fidelity (draft)
- Work branch `feat/167-connected-teacher-students-layout`, issue #167. Reuse original `TeacherPortal.module.css` students roster and detail, authorized `TeacherReadOnlyView` verified D1 roster and lessons, and `TeacherAcademicPlanEditor` for non-demo API.
- Existing public preview remains unchanged with `NEXT_PUBLIC_TEACHER_READONLY_ENABLED` default OFF; never assert browser-ready from this branch. Need CI, stage flag plan preserving public preview, role-provisioned teacher Chrome/screenshots/409/revoke, before closing.
- Recent account UX #160 remote Dev accepted via Santoreno #246, screenshot artifact #12937417843; Noor master #155 still open.

## #160 learner header/account responsive follow-up (draft)
- Remote account data lifecycle #157 passed on Dev, but screenshots revealed a clipped selector at mobile widths. Branch `fix/160-account-mobile-header-ux` groups profile actions and creates full-width mobile selector/anchored menu while retaining pending Quran save/role guards.
- Next: exact PR head Verify and real screenshots on open `noor-site-staging` 360/390/768/1280/1440; evaluate keyboard and long Arabic names; do not call the UX polished without remote screenshot review. No API/migration included.

## #162 non-Classroom teacher academic plan vertical slice (draft)
- Issue [#162](https://github.com/geminiamo0-ship-it/nour-elquran/issues/162); branch `feat/162-academic-plan-cas`. 0009 D1 plan projection plus immutable event/audit, verified primary qualified teacher plan GET/write and owner-only plan GET, strict DTO validation and learner-scoped connected teacher/student UI.
- Teacher notes here are teacher-authored next wird/revision/focus; **no AI Quran text or automatic homework**. Other academic features remain unconnected.
- **Do not merge/deploy before exact-head GitHub Verify; no authorized remote role provisioning or staging migration has occurred.** This slice needs separate synthetic Cloudflare Dev acceptance and approval of real teacher access; never bootstrap staff grants via a public endpoint.
- Last known Phase 01A: [Santoreno remote staging 40958341460](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40958341460) passed owner profile/archive D1+Chrome; Phase 01B guardian/OTP/recovery and mobile polish #160 are separate gates. Full master #155 remains open.

## Non-Classroom #155 — Phase 01A profile lifecycle remote PASS; next Sheikh #159
- Noor PR #158 squash main `68b218cf99ff436acf34292d39692a8011862c6a`; main push [Verify 40958071853](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40958071853) PASS. Existing Dev D1 migrated 0008; no data reset.
- Santoreno PR #243 (merge `a0b28bc4af7e95de983c37ff696174ffb9a9797a`) [staging 40958341460](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40958341460) PASS remote synthetic account+Chrome: 5 screenshot widths, owner A/B, siblings, rename after refresh, CAS conflict, archival 404, immutable audit and Quran history preserved. Screenshot artifact ID `12934533154`.
- Product gate: staging/test users ONLY. No OTP/guardian verification, production enable, payment/WhatsApp or Classroom operations. Visually narrow profile select under issue #160; connected Sheikh Home/My Students/Schedule next #159, which MUST reuse the existing portal components (not generic read-only replacement). Master #155 remains open.
- Exact next: implement #159 in focused branch using verified staff-created active Sheikh, correct empty/loading/denied states and per-route adapter; verify role denial and sibling boundary in native D1/Chrome then same normal staging. Concurrently scope guardian provider choices separately. Never touch Santo or Production.

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
