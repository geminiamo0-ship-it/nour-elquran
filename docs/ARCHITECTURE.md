# Architecture — proposed, not yet implemented

## Intended components
Browser (mobile-first Arabic UI) → Next.js on Cloudflare → API Worker → validated Auth + authorization → domain use cases.

Use-case dependent:
- StudentDO (keyed by student_profile_id): per learner active training / progress state.
- LessonDO (keyed by lesson_id): teacher report and lesson lifecycle state.
- TeacherScheduleDO (keyed by teacher_id): scheduling coordination; Postgres transaction remains final shared conflict guard.
- Cloudflare Queues / transactional DO outbox: asynchronous synchronization; consumer idempotency.
- Supabase Auth: account identity; PostgreSQL: shared profiles, schedule, subscriptions and reports.
- LiveKit self-hosted on Hetzner: real-time audio/video independent of Workers/DO.
- AI planning service through approved model adapter: produces structured exercises from teacher reports; not real-time Quran/audio authority.
- Trusted Quran text/authorized recitation API; browser MediaRecorder optional with consent.

## Key separation
Auth user_id can own multiple student_profile_id. Student data must never be keyed only by auth user_id.
No dedicated Parent Dashboard: account owner switches among learner profiles; adult single-profile path remains simple.

## Reads and writes
- No blanket "every request goes through DO" rule until per-domain performance/consistency needs are measured.
- Student-local active writes through StudentDO, shared reads through Postgres as appropriate.
- Financial and double-booking correctness uses Postgres authoritative transactions.
- Queue dispatch is at-least-once, not exactly-once; outbox and downstream dedup needed.
- LiveKit tokens are server-signed with lesson/user permissions; never expose API secrets.
- AI plan is advisory until verified and teacher-approved.

## Pending ADRs / verification
Frontend deployment adapter selection, ownership and permission matrix, outbox sync boundaries, session recording, audio licensing, payment provider and AI model/provider remain to be decided with owner before product implementation.
