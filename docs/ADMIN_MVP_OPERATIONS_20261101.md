# نور القرآن — Admin MVP التشغيل المبسط (#315)

**Execution:** GitHub PR #316. Cloudflare Worker + D1 only. Production remains untouched. Until this PR is merged and the isolated Santoreno Dev deployment succeeds, all content in this file describes *source implementation*, not live availability.

## Simple go-live paths

| Operator or learner | Exact signed path | Business meaning |
|---|---|---|
| Admin / teachers | `/admin/teachers` | Generate a 256-bit single-use invite, 7-day expiry, copy link; watch for claimed teacher, assign learners by name; can suspend with live/future lesson guard |
| Sheikh | `/teacher/join?token=...` | Register name/phone/password or log in, claim invitation. No learner profile or CV. D1 invite authorizes an active/qualified Sheikh role. Never a staff role |
| Admin / catalog | `/admin/packages` | Create, version-edit, disable EGP packages and number of sessions. Historical requests retain their quoted price |
| Learner / subscriptions | `/student/subscriptions` | View real academic entitlement, package prices, submit request, view status, open WhatsApp payment contact; a click is **not** payment or activation |
| Admin / requests | `/admin/requests` | Approve manually paid request or directly activate a student’s package with operator attestation; reject a request with recorded reason; confirm/reject free-trial request |
| Admin / settings | `/admin/settings` | Configure E.164-style WhatsApp digits without + or spaces. No WhatsApp API or notifications |
| Admin / schedule | `/admin/schedule` | Assign a verified current Sheikh to one or more learners, schedule 40-minute standard lessons against a real active cycle. Booking and one-credit debit are atomic in D1 |
| Learner / trial | `/student/lessons` | One default *eligibility* per learner, not an automatic lesson. Student requests a published 30-minute trial (40 minutes reserved); Admin explicitly confirms it |

## Security invariants

1. Every staff write authorizes an actual Better Auth signed session plus current verified `roles.manage` D1 grant; admin frontend state and JSON role claims are never authority. Changes also use D1 insert-time staff/owner/assignment/credit guards and idempotency operations.
2. Package prices are versioned append-only. A package request stores the exact version; later edits do not reprice an accepted historical request. A staff-only direct activation requires the currently active version.
3. Manual payment is recorded as an operator assertion, not a WhatsApp, bank, or payment-provider receipt. Activation also inserts `subscription_cycles` using migration 0026 ledger transactionally, one Cairo-local calendar month. Within-three-day renewal rollover obeys 0026 policy.
4. Trial confirmation inserts the existing `trial_booking_events` (which atomically creates lesson and assignment); no approval may be faked by the browser. Once migration 0030 exists, the old self-service `POST /trial-bookings` responds `TRIAL_ADMIN_APPROVAL_REQUIRED`.
5. Paid booking inserts `academy_paid_booking_events`; its D1 trigger creates both the 40-minute standard lesson and exactly one `subscription_spend_events` unit, or neither. No uncredited booking, no negative units, no overlapping teacher/learner lesson.
6. Each invited teacher link contains a 256-bit secret; only SHA-256 hash lives in D1. Claim uses authenticated account, one use and unexpired date, and checks inviter's *current* staff grant. Phone SMS/WhatsApp OTP verification is not claimed. The invitation is itself an entrusted credential: Admin must send securely.
7. Academic events and operator decisions are append-only and owner/guardian records cannot be switched or accessed by another signed household. A guardian with children can request different packages and lessons per learner profile.

## Known limits, not to hide

- **Cancellation and credit restoration**: spending is immutable. A standard cancelled prepaid lesson does not automatically refund a unit. An operator must use the approved separate D1 compensation flow; an Admin UI for compensation/refunds and student objections remains to be designed. Do not promise automatic refunds.
- **Pending paid lesson-time requests**: Admin can schedule a prepaid lesson. Student self-service *time requests for paid lessons* are not in this first source package; student can contact Academy via WhatsApp for a time. Package and trial request inboxes **are** connected.
- **Teacher roster pagination**: first 50 visible; additional teacher records need secure keyset page support tracked by #314. ID fallback remains for scheduling, but this is not production-complete pagination.
- **Admin receipt details**: manual confirmation is auditable; no real banking integration, transfer validation or receipt uploads. Never use a 'paid automatically' state.
- **Subscription cancellation/renewal**: monthly cycles and carry-forward logic are in the existing ledger; unresolved complicated no-show/academy-compensation policy requires separate operator review; no silent debit from attendance.
- **Notifications**: no automated WhatsApp SMS or reminder delivery added. Only the contact link works; previous in-app inbox continues.
- **Dev deployment**: Santoreno PR #338 adapts synthetic trial booking tests for the new staff-approval flow. Merge after approved CI, then source-pinned Dev stage and signed QA. No Production deployment permitted by this handoff.

## Release gate

All Noor Verify jobs on exact PR head: `repository-policy`, `governance-tests`, `code-quality`, `cloudflare-local-d1`. Inspect SQLite migrations 0029/0030, native signed HTTP behavior, no unexpected paid charge or auto-book. Conduct an independent security/privacy review of invitation and manual payment/credit mutation changes before merging. Require Santoreno Dev workflow to verify exact merged Noor main SHA and migrations and staff/guardian signed negative cases. No unreviewed Production or non-isolated database work.

## Durable continuation

1. Fix any failing PR #316 CI tests; preserve code and test gate.
2. Finish Santoreno PR #338 backwards-compatible trial test adaptation and green QA gates.
3. Verify signed local API positive paths and D1 0029/0030 with real temporary owner and staff accounts, plus idempotent replay/negative grants.
4. Merge and source-pinned deploy to Dev only after safety acceptance; verify signed Admin/Student/Sheikh pages on small/mobile and desktop.
5. Close #315 only after all go-live features accepted. Payment provider and additional self-service paid time requests can be separate post-MVP issues.
