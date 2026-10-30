# CR-02A LiveKit Cloud token gateway — source and no-secret Dev acceptance

Date: 2026-10-30 (Africa/Cairo). This record **does not** indicate a configured LiveKit Cloud project or an audio/video session.

## Exact evidence

- Noor [PR #201](https://github.com/geminiamo0-ship-it/nour-elquran/pull/201) merged squash `d231568d84748d5a16f0b496fbb0dad76898a084`. Exact Noor main [Verify #40996405754](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40996405754) **SUCCESS 4/4**, TypeScript/Node unit/native D1/prod build.
- Santoreno [PR #265](https://github.com/geminiamo0-ship-it/santoreno/pull/265) merged `6f98b8e0acf063608d156e3d4cff56225de6574a`. Isolated Noor Cloudflare Dev [#40996681563](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40996681563) **SUCCESS** — signed synthetic scheduled teacher+household learner **both joined** the existing LessonRoom DO, then API token request with **no** LIVEKIT_* secrets returned exactly **503 LIVEKIT_NOT_CONFIGURED** and **no** participantToken/serverUrl, with `Cache-Control:no-store`.
- Same run: forged room/role/grant POST body **400**, foreign Sheikh/household **404**, anonymous **401**, GET **405**. CR-01 DO two-role/25-second lease, report 07A, notebook 08A, archive 08B1 and disabled private-audio regression smoke all **PASS**. Synthetic assignments/staff permissions cleaned up. No LiveKit connection/paid resource was attempted.
- The local Node token test uses synthetic non-provider secret only and independently verifies the HMAC SHA256 JWT signature, 120-second initial-connect `exp`, role-separated opaque participant identities, exact lesson-specific room and least camera/mic-only grants. Tokens generated in tests are **not** valid LiveKit Cloud credentials.

## Implemented security boundary

Signed Better Auth, new D1 qualified acting teacher or household learner ownership, scheduled admission window/live lesson, and **actor-specific signed DO heartbeat** are required before issuance. Provider values are worker-only `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, with strict WSS Cloud hostname validation. No values from client input may determine room, identity, role or permissions. Missing secrets fail closed. Worker never uses roomAdmin, roomRecord, screen sharing, data publishing/automatic transcription, or remote unmute rights.

**Important limitation:** JWT expiry controls fresh joins, not already connected users. CR-02B must implement provider-side removal on revocation/lesson End, permission/device controls, explicit mic/camera action, WebRTC reconnect, and two-device audio/video proof before any real media rollout. Local/browser media UI, guardian privacy acceptance, provider account/billing and Egyptian mobile quality have not been tested.

No Production secrets, real minors, media recording or Admin Dashboard were touched. #200 remains open for connected provider-stage integration; #49/#50/#120 and #194 still open.

Next exact engineering action: CR-02B review and implement LiveKit Cloud **client SDK integration and server-side connected participant revocation** under new focused issue/PR, ready for credentials injected as Cloudflare Dev Secrets when the owner has a LiveKit project. Do not publish a connected room until test with a real account and two devices.
