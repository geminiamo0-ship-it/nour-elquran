# Noor #253 — Historical Quran marks in دفتر الحصص (read path)

A completed, signed and audited lesson now has a read-only **as-of End** academic annotation projection. Source: immutable D1 learner_quran_events ledger (0017), not a cloned lesson Mushaf, current materialized state, report drafts, simulated fixtures, or untrusted archive.

- Signed Better Auth owner and matching active child plus audited completed lesson required. Cross-household and unrelated lesson IDs return 404, without page identifiers.
- GET /v1/me/learners/:learnerId/lessons/:lessonId/quran-history lists pages that received shared events **during that lesson** (no page argument). ?page=N reads the last shared event **at or before** authoritative lesson ended_at_ms for each item on the requested page (including prior shared educational markings on the same page), omits hidden items and excludes later edits, private self-study, and legacy personal storage. 300 current marks per page maximum; source events are not mutated. Requested page must occur in the lesson's own event page list.
- Browser reuses the printed Quran renderer with non-editable historical ink and verse notes/highlights. No live cumulative overlay in this view. A new lesson/child selection resets data and ignores stale responses.
- **Not a signed/sealed report archive, PDF, R2 snapshot or backfill**. The separate published archive remains under #248. Earlier classroom strokes absent from the canonical ledger are not fabricated. Signed staging Dev two-role session and owner browser acceptance still required.
- This is one slice of #253: Sheikh task-draft marks and atomic publish, multi-page homework and full classroom student tools are still open; audio upload is #245.
- Verification: owner scope, authentic End, immutable event window, historical page scope, privacy, strict frontend parser and GitHub source CI. No Production flag changed.

Privacy: student-private annotations are **never** queried by this historical view; private teacher report drafts are not included.
