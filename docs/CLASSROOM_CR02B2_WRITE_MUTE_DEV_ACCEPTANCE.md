# CR-02B2 / Issue #206 — Staff write-time wake and Sheikh microphone-mute evidence

**Date:** 2026-10-30. **Accepted boundary:** source + no-secret Cloudflare Dev; **NOT LiveKit Cloud media/provider acceptance**.

## Actual merged code and exact CI
- Noor [PR #209](https://github.com/geminiamo0-ship-it/nour-elquran/pull/209), squash `812525274ceb549797f8ab821a38804839c81c04`. Exact PR-head [Verify #41001905697](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41001905697) **4/4 PASS** after fixing strict Lint failures. Exact main postmerge [Verify #41002079116](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/41002079116) **4/4 PASS**.
- Santoreno [PR #269](https://github.com/geminiamo0-ship-it/santoreno/pull/269) merged `c55b621499a0901a67cdec3c65245a7254c697ea`. Isolated Noor Cloudflare **[Dev #41002323938](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41002323938) SUCCESS** on signed synthetic accounts with no external LiveKit secrets.

## Actual Dev checks
- Valid acting Sheikh signed POST for microphone mute returned **503 LIVEKIT_NOT_CONFIGURED** (no false provider success).
- Forged `muted:false`, trackSid/room/participant identity all **400**; same call as learner **404**, anonymous **401**, wrong GET method **405**.
- LessonRoom two-person signed DO join/heartbeat/leave + 25s timeout, no-secret signed media token gate, report 07A, private notes 08A and no-fake-archive 08B1 all **PASS**.
- No external provider network call, live audio, video, recording, real child data or Production.

## Security implementation (source)
- A successfully committed D1 `staff/teacher-actions` suspension/revoked qualification wakes only affected live/near-starting lesson DO rooms; `staff/schedule-actions` cancellation wakes its exact lesson room. The private DO binding `/internal/reconcile-media` rechecks authoritative D1 state and triggers the same stored LiveKit removal outbox. Result `mediaEnforcement: sent` says **DO wake requested**, NOT provider eviction acknowledged; if DO unavailable the committed staff write stands and existing DO alarm/outbox is the fallback.
- Sheikh-only signed `POST /v1/teacher/lessons/:lessonId/mute-learner-microphone` requires exact `{}`, fresh D1 qualified primary/accepted substitute grant, signed DO heartbeat and a scheduled/live eligible lesson; the Worker reads learner household from D1. It lists provider tracks under an opaque HMAC room, selects **only matching learner microphone AUDIO SID**, and sends **`muted:true`**. No remote unmute, screen share, camera, browser-provided room/participant/track or recording.
- Local tests verify independent HMAC-signed provider admin JWT, server-only track selection, provider error fail-closed and private DO wake scoping.

## Explicit unresolved gates (Noor #206 stays OPEN)
1. **No user-owned LiveKit Cloud project/secrets provisioned on Dev yet.** No ListParticipants/MutePublishedTrack/RemoveParticipant real provider ACK, connected client eviction, 2-device quality or A/V permission evidence.
2. **No signed real Classroom End lifecycle API.** This work does not fabricate one. D1 status reconciliation sees ended/cancelled lessons eventually; write-time teacher suspension and staff cancellation are added, but a real End must be delivered and wired when authorized lifecycle transitions exist.
3. Provider disconnect timing and failover need an evidence-backed SLA, per-guardian child media consent and focused RTL 360/390/desktop session QA before real student use.
4. No Production A/V or staff Admin Dashboard until approved final stage.

Next exact action: provision owner LiveKit Cloud **Dev** project, set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` as **Cloudflare Dev Worker Secrets (never chat, frontend or repo)**, then two signed synthetic devices verify real provider mute/remove/token cutoff and reconnect; separately build real teacher-authorized Start/End. Follow up with independent issue/PR/tests and keep #206 OPEN until verified.
