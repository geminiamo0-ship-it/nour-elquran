# نور القرآن — Product plan and decision register

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
1. Landing (programs/pricing/contact sections), sign-in/register.
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
- Later: Supabase Auth/Postgres, Cloudflare API & Durable Objects, Queues/outbox where warranted, LiveKit VPS on Hetzner, AI plan orchestration.
- Data ownership needs explicit ADR: per-student interactive DO vs teacher scheduling/lesson consistency and Postgres monetary transactions.
- Priorities and boundaries must be recorded in individual feature issues, not simply inferred from this document.

## Pending decisions — discuss, do not assume
- Exact page designs and agreed development order.
- Onboarding/account owner responsibilities and child profile safe access.
- Lesson scheduling and teacher assignment rules, purchase flow and policy.
- Quran text/audio rights and selected recitation vendors.
- Frontend Cloudflare adapter compatibility and deployment configuration.
- LiveKit infrastructure and recording policy.
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
