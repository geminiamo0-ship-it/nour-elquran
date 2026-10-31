# #246 Attendance: signed preliminary evidence and 7-day appeal ledger

## This change adds (not a completed attendance/billing workflow)
- D1 0020 `attendance_incident_events`: teacher-authorized, append-only, idempotent preliminary `student_no_show` after **15 minutes** and `connection_interruption` in a live lesson. No lesson `status` or subscription/credit mutation.
- Signed teacher POST `/v1/teacher/lessons/:lessonId/attendance-report`: verifies Better Auth, current qualified acting Sheikh + D1 grant, and contemporaneous signed LessonDO **heartbeat**. A no-show report is rejected if the learner is present according to DO. SQL separately checks lesson scheduled, 15-minute cutoff, and absence of signed Start. A reported absence is **not a final absence nor a billable debit**.
- Teacher GET `/v1/teacher/attendance-cases`: only authored cases for the active qualified acting teacher.
- Owner GET `/v1/me/learners/:learnerId/attendance-cases`, POST `/v1/me/learners/:learnerId/attendance-appeals`: only verified active child/guardian, 7 days from recorded report, one signed immutable appeal with written explanation. No evidence attachments until private consented R2 policy is implemented.
- Admin/staff with explicit `attendance.review` permission: GET `/v1/staff/attendance-appeals` and POST `/v1/staff/attendance-appeals/review`. Immutable accepted/rejected decision and detailed reason, **no automatic compensation/credit issuance**.

## Privacy and safety gates
- No teacher, child, account or role can be self-declared in a public POST body.
- Every insert has D1 SQL source permission triggers and chronological bounds plus immutable audit; idempotent `operationId` only replays an identical operation.
- DO connectivity and lesson lifecycle are not inferred from browser time; no-show incident is a teacher report subject to administrative review.
- Existing student attendance preview and old teacher cases demo are NOT automatically changed by this backend source PR. They remain intentionally unavailable for connected accounts pending UI follow-up.
- External WhatsApp, payment/credit adjustments, admin final decision to compensate, R2 appeal attachments, and actual remote Dev E2E are OPEN. Production untouched.

## Staging acceptance
1. Apply migration 0020 only on approved Cloudflare Dev D1, test signed owner, teacher and staff.
2. With only Sheikh present at 14:59 after scheduled lesson start, report denied. At 15:00 with verified DO teacher lease and absent learner, report 201; if learner enters, report denied. Replays never duplicate.
3. Start a real signed lesson; attempts to file no-show denied. Live connection incident is allowed only with teacher's verified DO lease.
4. Owner of same learner reads case, submits appeal before seven days, reloads; unrelated sibling 404. After seven days, fresh appeal rejected.
5. Staff with `attendance.review` logs decision; unauthorized staff denied; no session credit changes. Full negative D1 trigger and mobile/browser checks required before Production.

## Rollback
Do not delete audit records or retroactively charge for reports. Disable user-facing routes / withdraw code in staging if necessary; preserve immutable D1 history and backup.
