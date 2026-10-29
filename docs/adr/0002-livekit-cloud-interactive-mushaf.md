# ADR 0002: LiveKit Cloud + interactive two-way Quran classroom

**Provider selection superseded on 2026-10-29 by [ADR 0004](0004-cloudflare-only-platform.md), owner Cloudflare-only adoption #104.** Shared-mushaf interaction/archive/privacy/no-recording requirements below remain approved. This historical ADR does not authorize a new LiveKit integration.


Date: 2026-10-28
Status: accepted **product direction**, implementation unverified
Issue: [#7](https://github.com/geminiamo0-ship-it/nour-elquran/issues/7)
Related roadmap: [#3](https://github.com/geminiamo0-ship-it/nour-elquran/issues/3)

## Context
Noor Al-Quran offers teacher/student lessons. Shared annotated Quran pages, teacher and student handwriting, typed notes, and permanent lesson revision archives are core classroom capabilities. Low-latency video alone cannot satisfy the product.

## Alternatives
1. LiveKit Cloud: managed room/media stack, easier browser integration and reconnect; usage-based cost and vendor dependency.
2. Cloudflare Realtime SFU: potentially cheaper traffic but more application-level media engineering.
3. LiveKit self-hosted on Hetzner: potentially cheaper at scale but greater operational responsibility.
Decision: prioritize managed media and focus engineering effort on the differentiating annotated Quran experience.

## Accepted decisions
- Use **LiveKit Cloud** for media; do not provision Hetzner as default.
- Teacher and learner can both use drawing, handwriting, highlighter, eraser, typed notes, and meaningful mushaf navigation interactions. Author attribution and permissions are mandatory.
- Preserve **structured lesson annotation data** plus **PNG/PDF renderings** linked to student profile and lesson, not just a single screenshot.
- Live annotation is a product capability separate from media transport; initial design candidate is React Konva with Cloudflare LessonDO/R2/Postgres, subject to technical verification.
- Retain canonical Quran source as read-only; render annotations in separate layers.

## Unresolved
Media event reliability and sync protocol, Quran page edition and annotation anchors, conflicts, handwriting tooling, export layout, costs, storage rights, recording consent/retention, real deployment credentials, mobile browser verification. Decide through approved implementation Issues; no unreviewed live recording.

## Consequences
The Classroom UX must allocate main space to the mushaf and writing tools, with video panes and sidebar notes. Architecture needs reconnect recovery and immutable archival snapshots, plus semantic export alignment across devices. This ADR is **not evidence that any feature has been built**.

## Verification
No UI/LiveKit or archive implementation exists. To be added through Issue #3-derived implementation slices with E2E mobile+desktop, synchronization and export correctness tests.

