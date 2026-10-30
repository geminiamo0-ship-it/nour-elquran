# CR-02A — Signed LiveKit Cloud token gateway, source-only until Dev acceptance (#200)

## Scope

LiveKit Cloud is the A/V-only exception in [ADR 0007](adr/0007-livekit-media-exception.md). Cloudflare Workers + D1 + lesson SQLite Durable Objects remain authoritative for session access, lesson status, Quran, notes, report publication and audit. This slice **does not connect or activate microphone/camera**, purchase provider time, establish a real remote media room, record media or mark attendance.

New Worker-only module `workers/api/src/classroom/livekit-token.ts` and two signed POST routes:

- `POST /v1/teacher/lessons/:lessonId/media-token`
- `POST /v1/me/learners/:learnerId/lessons/:lessonId/media-token`

Client must send `Content-Type: application/json` and exactly `{}`. Any provided room, identity, role, grants, teacher/learner IDs or options in body cause **400**. Existing Better Auth signed D1 session and same-origin mutation guard run first. Every request independently rechecks current qualified/active acting Sheikh primary or consented substitute grant / signed household owner for exact learner+scheduled/live lesson, then a bounded token-admission window: scheduled lessons from 15 minutes before start through scheduled end, or D1-live lessons from 15 minutes before start through **60 minutes after scheduled end**. This is a conservative stale-live rejoin cutoff, **not** a class termination, media eviction or attendance policy; any longer authorized extension needs a separate reviewed lifecycle change. Calls existing LessonDO's actor-verified **heartbeat**, not just snapshot of someone else being present. Expired/foreign/not-joined, missing DO or revoked credentials cannot mint.

Settings `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` are **server-only Cloudflare Worker secrets** (do NOT put them in `NEXT_PUBLIC_*`, `wrangler.toml`, git, deployment action logs or URL). This gate uses native Web Crypto HMAC-SHA256 (no new package), not external network calls. It rejects missing/malformed config, untrusted/non-WSS/non-livekit.cloud URLs, and returns safe `503 LIVEKIT_NOT_CONFIGURED` without any token. Before a secret is supplied, no LiveKit join credential is generated or remotely tested.

Token JWT: 120 seconds lifetime for **initial join only**, `iss` LiveKit API key; pseudonymous HMAC-derived per-lesson room and role+signed participant ID (no names/phones/auth subjects in LiveKit telemetry); `roomJoin:true`, `canPublish:true` but only `camera/microphone`, `canSubscribe:true`, **no** room admin, room create/list, room recording, data publishing, metadata changes, egress, transcription, screen sharing or participant moderation grants. The browser may only enable local tracks after explicit device permission and deliberate user action in a later UI slice.

If issued, success `200 {code:'MEDIA_TOKEN_ISSUED',serverUrl,participantToken,expiresInSeconds:120}` with `Cache-Control:no-store`, otherwise sanitized 400/404/409/503. Never log tokens or pass LiveKit secrets into frontend. Token room eligibility alone is **not attendance** and does **not** create a teacher Start/End action. A short JWT expiration restricts *initial connection*, and does **not** forcibly eject a participant after joining. D1 permission revocation and DO lease expiry must eventually be linked to the **LiveKit server-side participant removal API** for connected-user eviction in CR-02B; until then, NO production A/V release.

## Acceptance boundaries

- Fast Node tests `workers/api/tests/livekit-token.test.ts`: HMAC signature verified independently using Node crypto, TTL/expiry, non-PII room and role separation, exact grants, invalid config, scheduled window, missing DO/expired lease/wrong role and learner.
- Exact-head GitHub Verify (strict TS, Node, local D1, production build) is the source gate. A standalone Dev HTTP **disabled-config test** with signed synthetic teacher/learner 503/no token is separate; cannot test actual LiveKit media without user-owned account credentials.
- CR-02B remains **open** for secrets provisioning, real LiveKit SDK/browser track integration, two-device audio/video and reconnect, moderation/revoke/live eviction after assignment loss, Egyptian mobile network validation, guardian privacy decisions and targeted UI QA. No Chrome on every commit and no production resources or real minors. Parent #49/#50/#120 still open.

Rollback: remove both POST routes and module without changing existing private D1/DO history. Keys can be revoked in LiveKit Cloud without changing customer data. Admin Dashboard still last.
