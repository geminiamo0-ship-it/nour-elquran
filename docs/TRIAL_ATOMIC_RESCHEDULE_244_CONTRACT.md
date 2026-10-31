# Issue #244 — atomic signed owner trial reschedule (candidate)

## Scope
An eligible guardian/account owner may replace one currently **scheduled free trial**
with one currently published **alternative** slot in one D1 transaction.
This builds on migrations 0021–0022, 0023 ink compatibility, and the\n**0024 booked-slot withdrawal guard** proposed in PR #280. Apply 0024\nfirst and verify its populated Dev upgrade before enabling 0025.\nSigned Better Auth routes are required; it is
not an administrator dashboard, subscription activation, provider payment,
free-trial reset, WhatsApp dispatch, or Production readiness.

## Contract
- GET `/v1/me/learners/:learnerId/trial-reschedule-slots?lessonId=:oldLessonId`
  returns `{code:'TRIAL_RESCHEDULE_SLOTS',slots:[{slotId,startsAtMs,endsAtMs,instructionMinutes:30,reservationMinutes:40}]}`.
- POST `/v1/me/learners/:learnerId/trial-reschedules` with **exactly**
  `{operationId,oldLessonId,slotId}` (UUID v4 values).
- New lesson ID is **server-minted**, the Sheikh is selected only through
  the server-published eligible slot, signed owner scope comes from
  Better Auth and D1, never from the request.
- The old trial must be scheduled and at least six hours ahead by **Worker
  and D1 server timestamps**. Past, live, ended, consumed, cancelled,
  cross-household or cross-sibling attempts are denied.
- SQL trigger validates teacher availability, slot closure, lesson overlap
  and existing non-replaceable primary assignments. It cancels the old
  lesson, revokes **only its own temporary trial grant**, and inserts the
  replacement through the already audited 0021–0022 booking trigger.
  If *any* step fails, all changes roll back; the prior lesson survives.
- Operation ID replay returns the same new lesson ID for the same signed
  actor/learner/original lesson/slot. Conflicting reuses respond 409.
  Failure/timeout is **not** reported as successful to the UI. The
  guardian must refresh the signed lesson list before another attempt.
- No auto refunds/fees, trial count reset, automatic messaging, media
  recording or new shared R2 URLs. The replacement remains a free trial;
  a later approved Admin workflow owns late exceptions.

## Verification gates
1. CI TypeScript + Python SQLite full schema migration: new schedule,
   rollback on occupied slot, 6-hour boundary, sibling/owner denial,
   original grant release and immutable audit.
2. Exact-head GitHub Verify (all gates). Native Cloudflare local D1 smoke
   should apply migration 0025 forward-only; don't call CI green a remote
   Cloudflare Dev proof.
3. After review, deploy **isolated Dev only** with synthetic signed
   guardian + teacher, actual replacement, cross-owner 404, collision 409,
   refresh calendar, and no unexpected negative credit / double trial.
   Browser 360/390 RTL and a second account must pass before #244 closure.
4. Record exact SHA, run URL, and rollback (feature UI can be disabled
   by reverting its PR while keeping additive D1 immutable event history).
5. Remaining #244: approved subscriptions/entitlement ledger, verified
   payment integration, recurring paid sessions, staff exceptions,
   teacher slot availability publishing/QA, full multi-device tests.
