# نور القرآن — Product plan and decision register

## Current planning continuation — 2026-10-29 Cairo
Original foundation discussion below is historical. The owner requested a complete notebook/backend-readiness plan in [#101](https://github.com/geminiamo0-ship-it/nour-elquran/issues/101). Read [the consolidated Arabic plan](docs/LESSON_NOTEBOOK_AND_BACKEND_READINESS_PLAN.md) and current [status](PROJECT_STATUS.md) for scope, schema/API, authorization, publication, privacy, dependencies and measurable acceptance.

The approved three sections and canonical learner Quran remain unchanged. Engineering proposals and unresolved provider/operational choices are explicitly classified; documentation is not evidence of their approval, implementation or deployment. Next execution: [#102](https://github.com/geminiamo0-ship-it/nour-elquran/issues/102) notebook UI/contracts, then #46 identity/RLS. Existing #38/#46–#56/#87 remain implementation backlog.

## Original foundation decision register

**Status: DRAFT FOR OWNER DISCUSSION. NOT AN AUTHORIZED IMPLEMENTATION BACKLOG.**

## Product vision (agreed conversational direction)
- Online Quran memorization school for learners of all ages, with stronger priority on children.
- Teacher-led private live sessions, commonly 30 minutes; group classes can be considered later.
- Learner, teacher and administrator views. No separate parent dashboard.
- One account can hold multiple separately tracked learner profiles; adult users can study directly.
- Teacher reports: recited verses, mistakes, strengths, weakness, assigned recitation and next targets.
- After-class plan: an LLM suggests **structured** exercises; teacher reviews; interactive browser tasks guide listening, repetition, recitation/self-recording; parent/account owner can view summaries.
- Before next class: learner preparation + teacher preview.
- Quran text and recitations must come from authorized and verified sources; never invented by LLM.
- Visual direction: Arabic RTL, mobile-first, restrained traditional Azhar-inspired identity, dark gold/ochre with deep green/ivory, no generic AI aesthetic.

## Proposed pages (pending review)
1. **Approved landing design/structure** with same-page signup, programs, mushaf showcase and FAQ last; sign-in/register details after owner review. See [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
2. Profile setup and multiple sibling profiles within a single account.
3. Student home, schedule, interactive Quran, training, progress/reports.
4. Teacher home, students, timetable, classroom, evaluations.
5. Administration: instructors, learners, enrollment, lessons, payments, support.
6. Classroom: low-bandwidth audio/video, shared Quran, lesson feedback and controlled permissions.
7. Account settings/billing/support (not a separate parent dashboard).

## Current implementation strategy (pending detailed issues)
- Frontend-first using realistic non-sensitive mock data; **working flows, not decorative UI**.
- Shared contract schemas for future backend/AI interactions.
- Validate browser/mobile classroom shape early; implement LiveKit proper in later issue.
- Later: Supabase Auth/Postgres, Cloudflare API & Durable Objects, Queues/outbox where warranted, **LiveKit Cloud** real-time audio/video integration (approved provider), AI plan orchestration.
- Data ownership needs explicit ADR: per-student interactive DO vs teacher scheduling/lesson consistency and Postgres monetary transactions.
- Priorities and boundaries must be recorded in individual feature issues, not simply inferred from this document.

## Pending decisions — discuss, do not assume
- **Landing page is approved; other page designs and development order remain pending.**
- Onboarding/account owner responsibilities and child profile safe access.
- Lesson scheduling and teacher assignment rules, purchase flow and policy.
- Quran text/audio rights and selected recitation vendors.
- Frontend Cloudflare adapter compatibility and deployment configuration.
- LiveKit Cloud account, pricing/limits, token creation, traffic monitoring and recording policy. **Cloud provider is approved; no instance/account deployment is claimed.**
- AI planner model, report schema, teacher approval UX, safety verification.
- Branch protection and required check settings in GitHub.

## Milestones (placeholders, not delivery promises)
M0: Governance + repository verifications.
M1: Approved design tokens / frontend mock contracts.
M2: Learner and teacher frontend vertical flows.
M3: Backend auth/state/storage and billing.
M4: Live classroom integration.
M5: AI-assisted training and hardening.
M6: Production readiness, security, performance, acceptance.

Do not auto-create a backlog and start shipping these milestones until owner approval.

## Approved classroom behavior — decision captured 2026-10-28 (Issue #7)
- **LiveKit Cloud** chosen for video and audio, replacing earlier proposed self-hosted Hetzner/LiveKit option as the default. Choice does not mean integration has been implemented or paid subscription activated.
- Classroom is a **shared interactive mushaf**, with smaller teacher/student video panes. Audio matters most; video can adapt to weaker networks.
- Teacher **and learner** may both mark/write on the Quran page: freehand pen, highlight, annotate with typed side notes and handwriting, erase and undo/redo. Keep author attribution; define exact permissions, moderation and drawing conflict policy in UI specification.
- Shared navigation and synchronized annotation rendering, independent of video screen sharing. Render marks on an overlay; canonical Arabic Quran text is never altered.
- Upon lesson completion, associate both **structured, recoverable annotation JSON** and **rendered annotated PNG/PDF** with the lesson and selected student profile, so users can revisit marked mushaf pages and related notes.
- Teacher quick tags for recitation errors and assigned practice, and after-class reports, are expected workflows. AI practice generation remains later-phase and teacher-verified.
- Quran layout/page edition, coordinates, fonts, canonical content rights and commercial usage of recitations are prerequisite decisions.
- React Konva is a proposed annotation UI implementation for verification in first classroom spike; LiveKit Cloud and two-way drawing are accepted product choices.
- No default video/voice recording: saving marked mushaf pages/notes is **not** recording the live audiovisual session.

**Scope:** recording approved product decisions only; **frontend route designs, acceptance sequence and first implementation issue still require owner discussion in #3**.
