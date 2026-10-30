# CR-02B2 / #206 — LiveKit provider-side eviction (first backend slice)

Status: **source candidate**, requires GitHub Verify and isolated Cloudflare Dev. No provider keys configured, no real LiveKit room or Production use.

## Implemented scope

LiveKit remains the audio/video-only provider (ADR 0007); signed Better Auth + D1 + Lesson Durable Object remain authoritative for teacher, learner and lesson permissions.

Before issuing any LiveKit join token, the signed Worker sends an actor-specific **media-intent** command to LessonDO, which verifies the short room lease, persists media intent, and schedules reconciliation alarms every 10 seconds. Media intent cannot be specified by a public browser body. Missing provider credentials fail closed and prevent tokens.

On expired room lease, D1 revocation, lesson completion/cancellation, or explicit leave, LessonDO stores the *actual server-verified actor's* removal in a bounded persistent outbox. A fresh or restarted DO resumes outbox dispatch via alarms; provider timeouts, errors and missing config do NOT acknowledge successful removal. An unresolved pending removal blocks the same actor's rejoin/new media token, avoiding stale provider kicks after a new connection.

The Worker-only LiveKit RoomService client reuses the SAME HMAC-derived opaque lesson room and participant identity as the join token, signs a **60-second room-scoped roomAdmin-only JWT**, and POSTs to the fixed HTTPS Twirp RemoveParticipant endpoint using an explicit current-second revoke_token_ts. It never takes participant identity, media credentials or room from a public request. This revokes fresh LiveKit Cloud tokens as documented. No recording, unmute, room-wide action, sensitive child details, new frontend grants or Admin Dashboard.

## Test evidence and bounds

- Node tests sign/check room-scoped admin JWT with independent HMAC; verify exact provider host, opaque room/identity, explicit revocation cutoff, 4xx/5xx/network failure retry.
- Durable object tests for real media-intent lease requirement, alarm scheduling, leave, revocation/expiry, persistent retry across DO reconstruction and pending removal rejoin denial.
- Existing classroom waiting room, token issuer, D1 and Next build regressions remain required.
- **Important limitation:** poll and Cloudflare alarm timing are not instant; even a correct provider client needs real LiveKit Cloud two-device tests and write-time revocation hooks before use with real children. Do not claim instantaneous server eviction, real media success, provider ACK, or release readiness without those proofs. #206 must stay OPEN until provider runtime, moderation/mute-only, SLA, child consent and on-device QA pass.
- Source acceptance: exact-head GitHub Verify; isolated Dev acceptance may test only no-secret fail-closed state. No Production.

References: LiveKit participant management https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/ ; LiveKit RoomService API https://docs.livekit.io/reference/other/roomservice-api/ ; Cloudflare DO alarm docs https://developers.cloudflare.com/durable-objects/api/alarms/.

Next: inspect GitHub CI; then implement direct revocation-write hooks and authoritative teacher-only mute. Add isolated signed Dev test and eventually provider-enabled two-device acceptance with keys in Cloudflare Secrets, never GitHub.
