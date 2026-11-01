# ADR 0010 — Premium Islamic student portal and four-route navigation

- **Status:** Accepted as product design on 2026-11-01; implementation/visual acceptance remains pending
- **Decision owner:** Noor Al-Quran platform owner
- **Tracking:** [#322](https://github.com/geminiamo0-ship-it/nour-elquran/issues/322), [PR #323](https://github.com/geminiamo0-ship-it/nour-elquran/pull/323), master [#155](https://github.com/geminiamo0-ship-it/nour-elquran/issues/155)

## Context
The older authenticated student home used eight visible navigation choices, four mostly zero-valued metric cards and multiple redundant previews, which the owner rejected. The owner approved a **specific screenshot reference** shared 2026-11-01: modern premium Islamic identity, right-side forest-green ornamental sidebar, warm ivory content, restrained gold action hierarchy, Quran-on-rehal warm hero, large Arabic typography and generously rounded cards. This **supplements and supersedes the *student portal* part** of prior page concepts, but does not change the separate landing-page V3 brand/registration reference in `docs/DESIGN_SYSTEM.md`.

## Decision
Only four primary student destinations: `/student` home, `/student/lessons` all classes including notebook/reports/progress as tabs, `/student/training` published tasks/private practice/preparation, and `/student/mushaf` canonical Quran reader. Keep `/student/progress` and `/student/notebook` as functional legacy entrypoints into their respective lesson tabs; `/student/account` and `/student/subscription` remain reachable in a compact profile dropdown, with notification inbox on a header bell. Fullscreen Mushaf keeps its own special viewport; no sacrifice of Quran legibility to the sidebar.

Home only prioritizes **server-confirmed** live lesson, next upcoming lesson and assigned tasks. The real live-room button is built from the actual authorized learner/lesson IDs only for a live lesson; a future scheduled lesson may open its details but must not pretend to be active. Never infer fake progress percentages, grades or financial status. Sibling switching must retain the pending/private Quran save guard. Preserve all existing report revisions, academic plans, learner-private notes, attendance appeals, assignment uploads, account entitlements and server API authorization semantics.

## Styling boundary
Use existing Amiri/Tajawal and Quran-book/crescent identity. Approved portal reference allows richer rounded cards, deeper forest-green #064330 and soft gold accents than the minimal landing V3. Reproduce the visual using reusable Next.js TSX/CSS modules rather than baking text or fake data into screenshots. A compressed image crop of the owner-approved Quran hero reference is included as `apps/web/public/noor-hero.webp`; this is illustrative UI artwork, never canonical Quran source content.

## Consequences and acceptance
Positive: fewer navigation choices, clearer student first action, shared design vocabulary across four destinations. Risks: broken legacy links, hidden academic services, a false live-state CTA, desktop-to-mobile layout regression and privacy leakage through the learner switch/notification drawer. Tests and browser/Dev gates in #322 are mandatory. No production rollout is authorized by this ADR or by CI green alone.

**Implementation state:** PR #323 is source under review. Exact-head CI, screenshots at 360/390/768/1280/1440, signed Dev/browser verification and owner visual review are separate requirements. Rollback is a PR revert of UI-only changes; no D1/R2 migration or deletion is part of this decision.
