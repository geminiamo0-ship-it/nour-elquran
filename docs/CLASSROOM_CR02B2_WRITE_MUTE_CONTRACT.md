# CR-02B2 / #206 — Staff write-time eviction wake + Sheikh-only microphone mute

Status: **source implementation**. Exact-head GitHub Verify and isolated Noor Dev must pass before source merge. No LiveKit Cloud API credentials, connected audio/video or Production acceptance.

## Existing authoritative write paths actually in this repository

- Signed `POST /v1/staff/teacher-actions`: staff roles.manage, D1 teacher role audit event with atomic trigger. After a **successful or idempotently replayed** `suspend` or `revoke_qualification`, the Worker queries ONLY affected live or imminently startable lessons by D1 `teachers.id` and asks their DO to reconcile rights immediately. The user did not provide a LiveKit room, actor identity or provider track SID.
- Signed `POST /v1/staff/schedule-actions`: after successful/idempotently replayed `cancel`, Worker wakes the lesson's DO. Existing SQL forbids canceling live lessons and restricts cancellations to scheduled lessons ≥6 hours ahead; no fabricated End event.
- New Worker-only `POST /internal/reconcile-media` DO binding path accepts exactly `{lessonId}`, checks the DO's own room identity and invokes the same D1-backed `alarm()` right/lease reconciliation plus durable outbox. There is **no public Worker route to this internal endpoint**. Staff API response metadata `mediaEnforcement: sent|unavailable` indicates only whether DO reconciliation was requested, NOT that LiveKit ACK was received. Prior D1 write is not rolled back if DO unavailable; pre-existing DO alarm/outbox persists for media-intent leases.
- Teacher/learner ordinary room join/leave and all report/assignment APIs stay isolated. Guardian consent and voice recording policies unchanged.
- **Not yet present:** a real signed teacher-controlled Lesson Start/End API, or public substitute grant revocation mutation API. Therefore there is no real End write hook to attach at this stage. The DO's 10s D1 reconciliation detects terminal/unauthorized status once it is committed; a future explicitly signed End write must also wake the room **after** atomic D1 history commit.

## Teacher microphone-only control

- Signed and same-Origin `POST /v1/teacher/lessons/:lessonId/mute-learner-microphone`, JSON **exactly** `{}`, never a role, participant identity, track SID, room or `muted:false`.
- A newly checked active/qualified acting Sheikh (primary or accepted non-revoked substitute), currently scheduled/in session, must have an active signed DO heartbeat before provider access. Worker finds the exact household owner of the booked learner from D1, derives the same opaque LiveKit lesson room and learner identity, and signs a 60s scoped roomAdmin JWT server-side.
- Worker reads LiveKit `ListParticipants`, matches **only the exact learner identity**, picks server-reported `MICROPHONE` **AUDIO** track SIDs, and issues `MutePublishedTrack` with `muted:true` only. Never remote unmute, camera, screen share, another lesson, room-wide disable, or browser-supplied SID. It rechecks the teacher's active assignment before sending muting requests. Any invalid provider payload/error causes a sanitized fail-closed 503; no fake success or recording.
- The signed connected Sheikh A/V component has a clearly labelled button, with server ACK result; student has no moderation button.

## Tests and outstanding gates

- Source tests verify ONLY server-chosen microphone audio SID, no camera/screenshare/foreign participant, exact HMAC-signed LiveKit RoomService scope and `muted:true`, provider error, missing credentials/DO, teacher revoked; staff write-time wake only for scoped D1 lesson IDs and DO internal identity validation.
- Run exact-head repository policy, code quality / TypeScript / Node / Vitest and native Cloudflare D1 CI. Isolated Dev can test bad-origin, unconfigured provider, role isolation, and room/DO regression but CANNOT confirm provider ListParticipants/MutePublishedTrack or connected RemoveParticipant without real LiveKit account/Secrets.
- **Production A/V BLOCKED** until real LiveKit Cloud two-device provider tests, account guardian/privacy consent signoff, revocation/rejoin timing, RoomService ACK and verified lifecycle End, no recording. Periodic alarms and post-write wake are best effort, not an instantaneous hard SLA.

## Next

Verify, merge source if green, run isolated Dev no-secret regression and record links; then integrate actual signed Lesson Start/End and substitute grant revocation write path, and test real LiveKit Cloud with user-owned credentials inserted into Cloudflare Secrets only. Admin Dashboard remains the last stage.
