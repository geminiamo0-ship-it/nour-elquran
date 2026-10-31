# #252C — Signed End fence recovery (2026-10-31)

Depends on the merged, opt-in canonical ink bridge PR #262. This patch does not enable `NOOR_CUMULATIVE_INK_ENABLED` and never deploys Production.

## Problem
The verified teacher's End request first fenced the DO ink writer and drained `pendingQuranInk`. If the subsequent D1 lifecycle End batch failed, the room could remain in `quranInkClosing=true` despite a still-live lesson, preventing pen/marker activity indefinitely. An ambiguous D1 commit cannot be treated as failed.

## Fix / recovery contract
- The Worker passes its already-validated End operation UUID to the DO. The DO stores the signed Sheikh subject, learner and operation as its closing token, rather than an anonymous boolean.
- On an End failure, the Worker requests conditional release for **the exact same signed End operation**. The DO independently verifies the teacher and learner lease, matches its stored token and, most importantly, **rereads D1 status=live**. Only then it reopens drawing; unknown/unavailable/completed phase fails closed.
- A reattempt by that verified Sheikh may replace its stale closing token after a Worker crash; it still requires no pending D1 annotations and proceeds through D1 lifecycle CAS. Unknown legacy locks cannot be silently reopened.
- Successful D1 End preserves the closed writer and D1's non-live phase separately denies future strokes.
- Tests cover wrong operation refusal, D1-completed refusal, successful conditional release, and a failed D1 End followed by retry.

## Acceptance gates
Source exact-head 4/4 CI, then isolated Cloudflare Dev failure injection and real signed two-user D1 ledger/End checks. Learner public drawing/UI and global Reader/Notebook still gated; no Production activation.
