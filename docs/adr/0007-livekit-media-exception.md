# ADR 0007: LiveKit Cloud as Noor A/V-only managed media exception

Date: 2026-10-29 (Africa/Cairo)
Status: **approved owner-conversation implementation direction; integration and pricing not verified**
Tracking: #7, #49, #50, #120.
Supersedes: **ONLY the A/V vendor choice** in ADR 0004. All other Cloudflare-only architecture decisions in ADR 0004 remain binding.

## Context

The owner previously selected a Cloudflare-hosted application/data backend (Workers, D1, Durable Objects, R2, Queues), and ADR 0004 chose Cloudflare RealtimeKit as a *media evaluation target*. Later, the owner explicitly discussed and approved the interactive two-person classroom with **LiveKit Cloud for voice/video** and asked the assistant to carry through the end-to-end plan (#120). The implementation plan selected LiveKit Cloud as the media exception. Maintaining both vendor names as active implementation instructions would waste effort and create inconsistent room-token code.

## Decision

- **App and learner data stay on Cloudflare.** Workers = verified API/roles, D1 = booked teacher/student/financial and publication source, per-lesson SQLite Durable Object = authoritative live Quran events, R2 = canonical licensed Quran + private lesson snapshots/audio assignments, Queues/Cron = background outbox/notifications.
- **Use managed LiveKit Cloud strictly for real-time lesson audio and video** after a scoped two-browser implementation/quality/cost spike. This is a narrow explicit exception to the literal single-vendor wording, not approval to move learner databases to LiveKit or introduce Supabase/Postgres.
- Keep Quran annotations, navigation, error classification, Start/End and attendance decisions on the authorized Worker + LessonDO channels. LiveKit participant presence alone is insufficient evidence for approved Start or academic End. Do not make LiveKit packets the sole durable annotation store.
- Authentication/session and scoped room identity originate at Workers after BetterAuth session, learner-account match, active teacher assignment (or explicit guardian-approved substitute) and lesson-state checks. Grant least-privileged, short-lived room credentials; refresh/revoke on assignment changes. Students have no room-admin privileges.
- Enable **no recording / egress / automatic transcription** in production without a separate explicit decision, consent, rights and retention policy. Homework audio submission is a separate user-triggered R2 workflow.
- Sheikh can mute the student's microphone through an authorized server-side moderation flow, but never remotely unmute or enable it. Keep provider-side remote-unmute permission disabled. Student can enable their own microphone only after moderation release and user action.
- Teacher video self-preview can be hidden locally without disabling transmission; student video docks at side, can float/resize/redock; camera off is an independent track action.
- A/V may be interrupted by natural platform/network failures, but **neither 30m nor 40m timers may automatically end the educational lesson**. Only teacher explicit End changes authoritative class status. 40m is booked schedule occupancy; a separate 30m instructional target remains.
- Do not activate paid provider resources, public recording or real student data until environment-specific credentials and the owner-controlled billing/account authorization are safely configured.

## Migration of prior design documents

- ADR 0002 remains the historical LiveKit UX/origin and shared-mushaf policy record. Its earlier text saying provider choice was superseded by ADR 0004 is now historical; **ADR 0007 re-selects LiveKit** for A/V only.
- ADR 0004 remains source of truth for the app infrastructure and D1/DO/R2 requirements. Its RealtimeKit media target is superseded by this media-only update, not by changing database or auth direction.
- #49 should now be a LiveKit two-real-browser feasibility spike; #50 must use scoped LiveKit tokens with Worker+DO authoritative Quran sync. Do NOT build a parallel RealtimeKit integration unless the owner explicitly changes this decision again.

## Verification gates before any live A/V release

1. Official LiveKit project / secure credentials injected via provider secrets or deployment secret store; never committed or transmitted in plain chat. No user key currently claimed.
2. Two verified clients join only their booked room; attacker / sibling / another teacher fails. Teacher + learner both present required for Start. Disconnect does NOT count as End.
3. Teacher mute works with no remote unmute, separate local preview and camera track toggle, dock/float UI, mic/camera denied states and audio-only fallback.
4. Browser reconnection/rejoin and token expiry tested on Egyptian mobile and desktop networks; restore page and annotation operations through LessonDO, not LiveKit replay.
5. Measure participant-minute cost, availability and audio/video jitter before production rollout; retain a design reconsideration gate if commercial limits or region reliability fail, but don't silently switch provider.
6. Child data/privacy policy, private R2 archive, least-privilege access and per-lesson revocation, audit and operational recovery pass staging and CI.

## Non-claims

This ADR is a provider/architecture decision, not a LiveKit subscription, integration, new room, deployed Worker, automated class recording, or verified network/cost performance result. Media rollout must be implemented in focused, tested PRs after Worker/DO authorization and secrets exist.
