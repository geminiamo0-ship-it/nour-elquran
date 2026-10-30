# Classroom CR-02B1 — LiveKit browser media slice (#204)

**Status:** implementation is a source candidate until exact-head GitHub Verify, reviewed PR, isolated Dev disabled-provider smoke, and provider-enabled two-device acceptance. LiveKit Cloud is the approved A/V-only service per ADR 0007. Quran, attendance, marks and formal lesson Start/End remain on Cloudflare.

## Implementation

- Web client dependency pinned at `livekit-client@2.23.0` with reproducible `pnpm-lock.yaml`. No runtime CDN script, no provider SDK in the worker; lazy import occurs **only after** a signed participant explicitly clicks A/V connect inside the existing `/classroom/live` waiting room.
- The browser has only two narrow signed routes (teacher per lesson, learner per owned learner+lesson). Sends POST `{}` with no-store and same-origin cookies; never accepts room/grant/identity from query or response without strict URL+JWT payload validation. The Worker from CR-02A retains all authority: fresh Better Auth, D1 lesson and assignment, participant-specific LessonDO heartbeat, and 120s initial connect credential. No `LIVEKIT_API_SECRET` is exposed to frontend.
- The existing waiting room is unchanged as the authoritative connectivity gate. A/V UI renders only *after* successful explicit room join. A/V connection, camera, and microphone each require separate deliberate clicks. **No initial camera/mic publishing** on connect. The user can opt for mic-only or video-only; media stream is never recorded or published to R2. Teacher/learner has no remote unmute or recording buttons, no screen sharing, no data channel use.
- Real SDK manages audio/video subscribers, on/off tracks, reconnecting/reconnected/disconnected and track detach. Browser permission denial and blocked autoplay have recoverable Arabic RTL text. On DO heartbeat/authorization loss, waiting-room leave/unmount, component teardown releases local tracks, disconnects media and removes rendered remote elements. This is a *client self-disconnect* and **NOT provider-side eviction of a malicious/already-connected token holder**.
- Reuses existing signed `ConnectedWaitingRoom`, not the public mock `ClassroomPreview`; preserves Sheikh/student mobile layouts as a **temporary media panel**, with no core Quran redesign. Final camera docking/immersive layout in existing approved preview requires targeted owner visual QA.

## Security and release limitations

1. **Critical CR-02B2 mandatory gate:** enforce server-side LiveKit connected participant eviction on revoked teacher/learner assignment, lesson End/cancellation and DO room leave/expiry; no client-only disconnect claim as a security guarantee. 120s JWT TTL only controls *new join*, not already-connected media. Do not activate provider secrets for real customers or declare production ready before this server-side safety gate.
2. A/V client event correctness, one-to-one room join, media permissions and reconnect need *real* LiveKit Cloud credentials injected into the **Cloudflare Dev Secret store**, and true two-device QA with different signed accounts on Egyptian networks. No credentials exist in repo or Dev at this stage.
3. Consent, child privacy and guardian policy, camera/phone OS behavior, opt-in audio, reconnect and mobile UI review remain future acceptance tasks. Do not record, transcribe, log or retain any media; no R2 audio video pipeline.
4. Presence is a lease, not formal attendance; no teaching timer automatic End. No fake live Quran pen/marker syncing or archive proof in this slice. Admin Dashboard LAST.
5. CI: exact pinned lockfile, strict TS/ESLint, component/token parser Vitest, Node classroom API tests, native D1 and production build. No blanket Chrome; focused 360/390/1280 targeted UI check only after integration.

## Next handoff

- Confirm exact-head PR Verify for #204, merge only if all checks pass; record merge and postmerge Verify. No provider-enabled staging claim.
- Open CR-02B2: authenticated server-side LiveKit participant removal and teacher-only mute-without-unmute; reject already-connected revoked sessions. Reconcile DO lease and LiveKit participant list without trusting client role/room.
- After owner provisions LiveKit Cloud Dev credentials, test two actual devices, no-recording, camera/mic off by default, reconnect, provider-side revocation, user consent and Cairo/Alexandria network conditions.
