# Owner two-account hands-on QA: classroom UX correction and open blockers (#284)

## Reproduced in current main code
1. The classroom header has two independent status surfaces. Its room-presence menu said **"الطرفان في غرفة الانتظار"** whenever both DO leases exist, even after an official D1 Sheikh Start. Manual **"تحديث حالة الطرفين"** refreshed only presence, NOT authoritative lifecycle. This was misleading but was not proof that D1 Start failed.
2. Backend `startedAtMs` is already signed in D1; no elapsed timer was rendered.
3. Page/ayah and live ink snapshots were both polled every **2000ms**, exposing ~0–2s between remote saves and the next visible snapshot, plus actual request/render latency.
4. Pen/marker disabled by design: `NOOR_CUMULATIVE_INK_ENABLED` is absent (OFF), so signed `canWrite=false`. **Do not toggle it on Production or mark #252 accepted until signed two-device durable ink and outbox reconciliation passes.**
5. Sheikh `teacherInkDraftClient.list` failures were swallowed into `null` and presented as generic **not available**, making it impossible to distinguish schema, authorization, unexpected response and network. The editor remains fail-closed rather than silently dropping marks.
6. R2 recorded homework audio is explicitly LOCKED by #245 and is not silently enabled. LiveKit camera/microphone requires user action and targeted native two-browser permission/signal debugging, not assumptions.

## This corrective PR
- Show **time elapsed from confirmed signed D1 Sheikh Start** in the classroom compact header. Recompute every 1s; never infer start from page load or attendee join. No auto-end at 30 or 40 minutes.
- The manual refresh now requests both presence and signed lifecycle. Presence menu changes wording based on D1 phase; a learner rejoining an already-live lesson sees **العودة للحصة** instead of being told it is only a waiting room.
- While the user is present and the document visible, interval for shared page and signed ink snapshots changes from 2000ms to **1000ms**; this decreases additional client polling latency, *not* network/render/server latency and is not a WebRTC or eventual-consistency guarantee.
- Explain why pen/marker controls are inactive in an unapproved Dev environment, rather than silently disabling them.
- Preserve and display exact **error code** for teacher homework draft GET, with retry and separation from successful text-only assignment publisher.

## Real acceptance before owner repeat test
- Deploy exact verified main to isolated Dev `noor-site-staging` / `noor-core-staging`. Confirm teacher Start recorded via D1, student status changes to `الحصة جارية`, elapsed timer on both devices and explicit End + report.
- Measure shared page/ink from button/drawing ACK to opposite screen (p50/p95 on actual networks); do not claim guaranteed subsecond delay from a 1s polling interval.
- Verify Sheikh drafts GET status and error **code** in signed session, D1 0018 schema row, write draft and publish a mark; never enable anonymous or unreviewed write capability.
- LiveKit media session: adult synthetic Sheikh on desktop and learner on mobile, grant mic/camera only by device buttons, check permissions, provider publication and remote rendering, rejoin after network interruption.
- R2 homework voice upload/teacher review #245 not yet implemented, test as disabled and plan it separately.
- Cumulative classroom ink #252 remains OFF until real two-role signed Dev outbox + reload + permanent learner Mushaf proof.

No Production flags, D1 schema changes or real-child media in this source PR.
