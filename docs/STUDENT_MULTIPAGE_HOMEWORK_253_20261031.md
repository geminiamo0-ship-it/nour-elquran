# #155 / #253 — Published multi-page homework must stay inside "تدريباتي"

## Finding and fix
Previously `StudentPublishedAssignments` embedded `TrainingQuranSession` only
when the confirmed task had `startPage === endPage`. For a real published
range across 2+ Mushaf pages, its primary action sent the learner to the
generic 604-page personal reader, losing the task's selected chapter/range
focus, practice actions and in-context teacher submission.

All **signed published tasks** now open the same `TrainingQuranSession`.
The task's authoritative `startPage` and `endPage` from owner-scoped
`assignmentClient.owner` define the allowable page window. Quran page
navigation is bounded, with previous/next buttons and a page counter.
Each page continues to reuse `ReaderPrintedPage` with the cumulative
owner-scoped Mushaf ink overlay and a fixed task verse focus; the optional
independent text concealment, listen, self-recitation, and written teacher
submission remain inside the same assignment.

The rendered Quran isn't copied into another storage layer; task marks are
still sourced from the canonical learner Quran ledger. Invalid page bounds
fail closed instead of opening a wrong Quran page. The classroom sync page
and Guardian profile remain independent of the homework viewer.

## Acceptance gates
- Local unit tests: one/multiple pages, final boundary, corrupted, invalid,
  out-of-book, NaN and out-of-window navigation.
- On approved Cloudflare Dev, publish a teacher task crossing a page boundary
  (e.g. authorized `startPage != endPage`), open as its verified learner,
  move forward/back, conceal/unconceal, play signed audio and submit a
  written attempt. Test a second sibling for negative scope.
- On mobile 360x667 / 390x844 and desktop, inspect focus/scroll,
  responsive nav and returning to the correct assignment. Test S Pen
  private cumulative owner marks, reconnect and page history.
- Voice upload to R2, lesson audio, multi-ayah audio controls, fixed task
  notes and actual remote visual acceptance remain separate work, not
  considered delivered by this PR.

Production flags, payments, Cloudflare D1 schema and child media remain
unchanged.
