# CR-01 signed waiting room — isolated Cloudflare Dev acceptance

Date: 2026-10-30 (Africa/Cairo)  
Scope: **server-side signed Better Auth/D1/SQLite Durable Object presence and minimal connected UI, NOT live Classroom teaching.**

## Exact source and runtime evidence

- Noor source [PR #197](https://github.com/geminiamo0-ship-it/nour-elquran/pull/197) merged `dfbe6d68c6817c2022cf7a1c17fad4906b922981`; [main Verify #40993668189](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40993668189) **SUCCESS 4/4** (architecture policy, governance, TypeScript/lint/build/Node unit tests, local D1).
- Santoreno isolated Dev [PR #263](https://github.com/geminiamo0-ship-it/santoreno/pull/263) merged `c3653398a786e0a7c182caa32ac55e4dcc68e2a2`; [real Cloudflare Dev run #40994099005](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40994099005) **SUCCESS**: new SQLite LessonRoom DO class/binding provisioned on **noor-site-staging only** and existing Noor D1 `noor-core-staging`. Session-authenticated synthetic Sheikh+household-owned learner joined one scheduled lesson with persistent shared presence; GET/heartbeat/rejoin/leave, 25s lease expiry, 400 forged role/identity, 404 foreign/sibling, 401 anonymous, 405 wrong method. No D1 Start/End/attendance was fabricated by joining; `canStart:false`, `mediaReady:false` before and after both users present.
- Prior report 07A, notebook 08A, read-only Quran archive 08B1, assignment and disabled-audio privacy regressions remained green in the same run.
- [PR #199](https://github.com/geminiamo0-ship-it/nour-elquran/pull/199) (follow-up) fixes React StrictMode effect replay on the connected waiting-room UI; check its own exact-head Verify before merge and do **not** imply a separate browser visual QA.

## Boundaries / not shipped

1. Signed room presence is a short-lived **connectivity lease**, not proof the human was physically present or teaching; no attendance, credit debit, automatic lesson Start/End, or substitute correction powers derived from DO status.
2. **LiveKit Cloud remains the chosen A/V vendor** (ADR 0007) and is NOT connected; no live tracks, device permissions, video or microphone sharing, recording or token issuer has shipped.
3. Shared Quran page navigation, streamed ink/error corrections, durable event replay and trusted Classroom DO checkpoint seal into Phase 08B2 archives (#194) are not implemented.
4. Mobile/RTL/multi-device owner visual acceptance is outstanding; this evidence is about API+Dev behavior, not a final Classroom UI.
5. No Production binding, payment, Admin Dashboard, public child media or data. Admin Dashboard remains last.

## Next engineering gates

- CORE #49: LiveKit Cloud credentials and per-lesson participant token gateway, scoped signed actor+room role, short TTL, explicit audio/video consent on each device, real two-browser reconnect and revocation. Never put LiveKit API secrets into frontend or GitHub files.
- CORE #50 / Classroom #120: integrate real authorized DO page/ink events and explicit teacher Start/End with signed two-sided presence; do not reuse a demonstration or synthetic END as a real attendance record.
- Phase 08B2 #194: trusted private snapshot outbox, source digest verification, immutable report-revision bound Quran archive.
- Keep #196 open for targeted real mobile/desktop waiting-room UX and eventual Classroom integration; Santoreno Dev task #262 can close with this test evidence.

Rollback: remove UI/live routes or isolated DO binding, but keep real D1 classroom/report/audit histories. Do not alter production or mint any access fallback.
