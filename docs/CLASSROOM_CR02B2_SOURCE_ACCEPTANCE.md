# Phase CR-02B2 / Issue #206: first provider eviction backend slice merged (2026-10-30)

**Noor source:** [PR #207](https://github.com/geminiamo0-ship-it/nour-elquran/pull/207) merged squash `6a490efea53fec243facf09b5e5489910cd48b3b`. Exact PR-head [Verify #40999824319](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40999824319) 4/4 SUCCESS (earlier failure #40999725431 fixed: DO snapshot was incorrectly written; now read-only). Noor merged main [Verify #40999944470](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40999944470) 4/4 SUCCESS.

## Accepted only at the source/local test boundary

- Shared HMAC-derived opaque LiveKit participant locator for join and provider-side eviction. HTTP Twirp RemoveParticipant with fixed HTTPS LiveKit Cloud hostname, 60s room-bound roomAdmin JWT and explicit `revoke_token_ts`; no public room/admin API.
- Cloudflare per-lesson DO actor-specific durable media-intent recorded before any LiveKit client token is minted, 10s reconcile alarm for current D1 signed teacher/learner rights and expiry of 25s connection lease. Leave/expiry/revocation/ended lesson schedules provider eviction in bounded persistent outbox, retries on non-2xx/provider outage across DO restart, unresolved same-actor ejection blocks reuse of that LiveKit identity. No voice/video recording, no admin enrollment or Production.
- Node tests verify admin HMAC signature/payload without a provider call and DO expiration/revocation/outbox/restart. Existing signed room, API, D1, browser build and other non-Classroom backend tests passed.

## Not accepted, required to close #206

- **No real LiveKit credentials** exist in Dev; the provider RemoveParticipant API has NOT been called or acknowledged, and cannot be claimed operational.
- Cloudflare DO alarm/reconciliation is eventually enforced with timing subject to scheduling delays. **Immediate D1 write-time permission revocation hooks and guaranteed bounded provider eviction SLA are not delivered.** Already-connected media could persist until removal; never deploy to real students.
- Teacher mute-only (without any remote unmute), real two-browser media capture + reconnect/permission UI, child guardian/privacy consent and actual cloud revocation cutoff proof remain open. 120-second join token TTL is NOT an already-connected session cutoff.
- Santoreno [PR #267](https://github.com/geminiamo0-ship-it/santoreno/pull/267), merged `0844710c1898bd15dc06fbd6394adbc6f9486cf9`, triggers an isolated Noor Dev **no-secret denial** smoke. It ran as [Cloudflare Dev #41000153415](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/41000153415) **SUCCESS**: signed Sheikh/student public attempts to invoke internal `media-intent` returned 400, signed media-token without secrets returned 503/no token, foreign 404, anonymous 401, ordinary CR-01 25-second DO room and 07A/08A/08B1 regressions PASS. This is NOT an actual LiveKit provider eviction test.

Next engineering: integrate direct revocation triggers into authoritative lesson/teacher write endpoints as they are delivered, implement teacher mute-only, then use a LiveKit Cloud Dev project with secrets stored in Cloudflare and two signed test devices to verify removal/cutoff/rejoin. Continue to shared Quran sync/immutable archive only after Classroom gates. Admin Dashboard stays final stage.
