# Noor Classroom realtime upgrade — issue #297

## Target and limitation

The owner requests effectively instant shared page/verse, pen, marker, corrections and classroom state. **Zero milliseconds over a network is physically unattainable.** Target a verified p50 <=100ms and p95 <=250ms for *visible remote feedback* between signed Sheikh and learner browsers on representative mobile/desktop networks; report actual measurements without hiding outliers.

## First bounded slice in PR #296

- Server-authenticated same-origin WebSocket GET endpoints with existing Better Auth + current D1 lesson/teacher/owner checks.
- The Worker supplies the **verified** actor envelope only to the per-lesson Durable Object over an internal binding; browser never chooses a privileged role/subject.
- The DO rechecks its active 25s room lease and fresh D1 authorization on connect and *again before each broadcast*. Revoked or expired participants are closed. Up to six room sockets.
- DO sends only bounded `{type:'quran-page'|'quran-ink',page,revision}` **after** its committed page or ink transaction. It never publishes student-private notes or claims an outstanding DO-to-D1 outbox is safely committed.
- The browser immediately fetches an authenticated authoritative page/ink snapshot upon a hint, reconciles after reconnect, and keeps one-second polling as a fallback. This avoids 0–1s idle polling delay on most healthy realtime connections but **still includes signed GET network latency**.
- Default OFF on both sides: Worker env `NOOR_REALTIME_HINTS_ENABLED=true` and frontend build `NEXT_PUBLIC_NOOR_REALTIME_HINTS_ENABLED=true` are **both** necessary. No new runtime capability is enabled by merging source alone. `NOOR_CUMULATIVE_INK_ENABLED` remains OFF unless its separate durable-write rollout is approved.
- No Production writes, no secret/body/cookie forwarding, and no LiveKit recording.

## Subsequent development implemented in this PR (still unmerged and OFF)

- Bounded provisional ink frames: `start/move/end/cancel`, sampled 32ms pointer updates, at most 64 normalized points/frame, no canonical save claims, no persistent DO stroke writes from the WebSocket.
- Sender identity is always the authenticated DO socket attachment; server requires the **separate cumulative ink gate**, live D1 lesson status, fresh acting teacher/learner grant, active 25s room lease, current shared page, and a 20ms per-socket move-frame limit.
- Peer receives only a temporary drawing overlay; existing signed final POST retains all points, CAS/idempotency and durable outbox reconciliation. Out-of-order deltas are dropped and fixed by the final signed GET snapshot. Preview expires without a save receipt.
- One-way `presence` revision hints after join/leave; `corrections` revision hints sent **only to authorized Sheikh sockets**, never to learner or sibling. Notes text remains Sheikh-private.
- A separate **frontend opt-in** `NEXT_PUBLIC_NOOR_REALTIME_PREVIEW_ENABLED=true` is required in addition to the existing realtime hints frontend/Worker flags. Backend previews also require `NOOR_CUMULATIVE_INK_ENABLED=true`; no flag is turned on in this PR. Until approved, the legacy behavior remains unchanged.

## Gates before isolated Dev activation

1. Independent reviewer examines session+origin protection, Worker->DO actor derivation, authorization expiry/revocation, DoS/reconnect, and hibernated WebSocket API compatibility.
2. Verify source exact SHA; run all four Noor `Verify` gates and native D1 smoke. Keep source policy gate and Santoreno staging gate intact.
3. Set both realtime hints flags in **Noor isolated Dev only**. Do not change Production or turn on cumulative live ink because this source has realtime transport.
4. Two browser sessions: Sheikh on PC and student on mobile; both sign into *their own* eligible lesson. Test page/ayah, committed ink, reconnect, stale page, user logout and role revocation, expired DO room lease; no inappropriate cross-sibling updates. Ensure anonymous or cross-origin WebSocket attempts fail.
5. Measure elapsed time from local visible interaction/pointer event to opposite browser render with synchronized clocks or in-page ACK protocol. Record p50, p95, packet loss, distance/device/network type and socket reconnect. Do not use only HTTP 200 time or poll delay as latency result.

## Required follow-up to achieve the full user experience

- **In-flight ink previews** now have a bounded first implementation; pending Dev WebSocket transport validation, 2-device frame telemetry, sub-100ms optimization, and adversarial session-revocation load tests. A provisional preview is never a persisted ink ledger entry; finalize through signed DO CAS and outbox.
- **Page/verse:** send the authoritative validated state itself after commit, not only a revision hint and second GET when feasible.
- **Notes/corrections/Start-End/presence:** corrections private Sheikh-only and join/leave presence hints are now included. Still need post-D1-commit Start/End notifications, robust attendee departure signaling on expiry, bounded notes and all other safe scoped events. Student-private notes NEVER sent to Sheikh unless explicitly shared; report versions remain immutable.
- **A/V:** retain LiveKit Cloud for independent camera/microphone, consent, participant removal and reconnection.
- **Recovery:** no silent loss after reload, disconnected devices get signed snapshot/full revision reconciliation; always report pending vs saved clearly.

A passing PR Verify is source-level proof, **not** proof of 100ms, Dev activation, or live customer readiness.
