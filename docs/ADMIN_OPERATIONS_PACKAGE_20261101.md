# Admin consolidated operational package — 2026-11-01

Issue: #309. Owner requested completing the Admin operational UI in a single package after the signed read-only Admin #304/#306/#308 had been merged and accessed in Dev.

## What this PR actually wires (candidate; no remote Dev acceptance yet)

| Admin route | Source of truth | Proposed operation | Server gate | Limits |
|---|---|---|---|---|
| /admin/teachers | \`GET /v1/staff/teachers\` | Provision a **previously registered/verified** teacher account, or select an existing Sheikh to qualify/activate/suspend/de-qualify | Current Better Auth + D1 \`roles.manage\`, default-off Admin flag for new roster transition, event triggers | No invitation delivery, photo, CV or qualification-document vetting workflow yet |
| /admin/schedule | \`GET /v1/staff/collections?view=schedule\` | Primary assignment, revoke assignment, cancel an existing scheduled lesson | Current signed \`/v1/staff/schedule-actions\`, D1 immutable events, availability/conflict and 6h cancellation checks | Manual booking intentionally NOT surfaced: trial eligibility, confirmed academic credit and paid entitlements require authoritative validation |
| /admin/attendance | \`GET /v1/staff/collections?view=attendance\` | Accept/reject a pending attendance appeal, with justification | Current signed \`/v1/staff/attendance-appeals/review\`, separate D1 \`attendance.review\` permission and immutable audit | A decision does not automatically debit, refund, compensate, punish or notify |
| /admin/students | Signed students collection | Read learner ID for scoped assignment | Current staff overview/collection check | No guardian contact, household data, arbitrary cross-sibling mutation |
| /admin/subscriptions | Signed D1 academic credit cycle collection | READ ONLY | Staff grant | Does NOT assert paid status, enable credit issuance, payment, refunds or settlement |

## Security and behavioral contract

- All actions require the currently verified session and server/database permission checks; a link or browser-side choice never grants a role. The account's existing D1 staff grant was created manually by its operator and is not provisioned by this PR.
- New \`/v1/staff/teachers/transition\` accepts an exact action, reason, UUID and opaque roster \`teacherId\`. Only AFTER current staff authorization does D1 resolve the private \`auth_subject\`; no phone, email, account subject or other roster member's identity is sent to the browser.
- The new additive migration \`0027_teacher_active_lesson_guard.sql\` atomically prevents teacher \`suspend\`/\`revoke_qualification\` writes if that teacher still has a future or active scheduled/live class. Existing legacy teacher-actions get the same protection once the migration is deployed. Cancelling/covering active lessons requires a separately valid, audited command.
- All POSTs are explicit and require a nontrivial reason, a per-action \`operationId\` UUID, acknowledgement checkbox and actual server response before showing success. A network failure yields UNKNOWN, not a false success/failure. Only explicit replay with the **same** operationId+payload is offered. Revocation/account changes abort pending client reads. Do not copy sensitive IDs to logs.
- Record lists remain bounded and read-scoped; IDs surfaced are opaque academic resource IDs only. Finance, guardian contact, private media, notes and incident reason are not exposed in list cards.
- Worker/Next Admin feature flags stay default OFF outside explicitly approved isolated Dev. Production unchanged. No Cloudflare migration or runtime deployment is claimed by source commits.

## Source and isolated Dev acceptance checklist

1. Exact-head repository policy, ESLint, TS strict, Vitest, Node tests, Python full-migration tests, Next static export and native Better Auth+D1 verification: all green on the same commit.
2. Independently review role gating, new teacher transition handler, migration ordering and transaction-safe suspension guard. Never merge an unreviewed source candidate solely because CI is green.
3. On isolated \`noor-site-staging\` / \`noor-core-staging\` only, apply migration 0027 through the verified staging pipeline. Verify exact schema metadata and that a booked Sheikh cannot be suspended.
4. Signed Dev synthetic staff role transition: active qualified Sheikh selection; approved transition recorded once; replay exactly once; conflict 409; unsigned 401, guardian/Sheikh 403, grant revoked 403, invalid payload 400, flags off 404.
5. Signed Dev synthetic schedule: correct primary assignment, overlap rejection, six-hour cutoff for cancellation, no silent calendar balance correction, D1 audit one event; ensure no booked charge or paid subscription credit is fabricated.
6. Signed Dev synthetic attendance: independent \`attendance.review\` grant required; pending case accept/reject with reason, replay safe, sibling/other actors denied, confirmed review visible after refresh and no silent compensation.
7. Chrome 360x667, 390x844, 768, 1280, 1440 RTL; signed session swap, logout, role revocation, keyboard navigation, long Arabic reason, pending/error/uncertain states and no horizontal overflow. Don't screenshot real child/guardian identities.
8. Restore grants and synthetic state; record exact source SHA, staging run, migration and browser evidence. Production release requires separate security/privacy/financial approvals.

## Still OPEN — do not claim the 16 Admin programs complete

The full academy operating dashboard defined in #20–#36 remains wider than this package:
- Teacher onboarding invite link, secure candidate register, CV/photo/qualification documents (R2), approval and credential workflow; current manual provision targets an existing verified account.
- Qualified availability, leave, substitute consent and substitute expiration; recurrent schedule generator, staff rescheduling under 6h and compensation approvals.
- Verified payment provider, price/package model, callback signature, reconciling settled payments, fiscal ledger, refund/chargeback, billing and manual renewal; no bypassing immutable academic ledger.
- Support and incident case ownership; live lesson operational signals; reports/academic oversight; permission administration/MFA; notification queue/WhatsApp opt-ins/provider/templates; analytics, exports and retention controls.
- Every remaining feature requires its own auditable contract, auth test, UX acceptance and provider decision before it can be truthfully marked operational. Consolidate their delivery into one release program where practical, but do not make provider-free UI simulate payments or external WhatsApp success.

## Rollback

Revert new Admin operations UI, transition handler and optional new route, while leaving existing read-only pages. Migration 0027 only tightens behavior; rolling it back would reopen a race, so use a reviewed forward migration rather than removing the guard from a live D1 database. No production rollback needed because no production deployment is authorized.

## 2026-11-01 follow-up security review (still source-only)

- Identified that legacy `attendance.review` grant checks required an active account but **not** `auth_users.phone_number_verified=1`. The signed Worker helper `staffAllowed()` now independently requires a verified account, and additive migration **0028_attendance_verified_staff_guard.sql** rejects the same violation atomically for direct D1 review inserts. The attendance review POST returns 503 until the 0028 guard metadata is confirmed, preserving fail-closed deployment sequencing.
- Refined migration **0027** and roster Worker check: `status='live'` blocks teacher suspension and de-qualification **regardless of scheduled end time**, because a teacher must explicitly end a classroom even after overtime. Future `scheduled` lessons also block these transitions.
- Added native signed Worker smoke to `scripts/cloudflare-auth-smoke.mjs`: unknown/unsigned/non-staff/malformed roster transition denial; actual booked lesson blocks suspension with 409 and the teacher remains active. Python full-migration tests cover overdue `live` and unverified attendance reviewer denial; Node tests cover query-first permission gating.
- Next isolated Dev release requires migrations **0027 AND 0028** and role/case/booking signed acceptance, and independent code/permissions/privacy review. Source green is not Dev accepted, and no Production operation is authorized.
