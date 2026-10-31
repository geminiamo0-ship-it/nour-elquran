# #155 / #242 — Student Training preparation: no demo lesson in signed account

## Finding (2026-10-31)
In `apps/web/src/features/student/components/TrainingWorkspace.tsx`, the
`الاستعداد للحصة` tab always calculated `nextBookedLesson(selected.lessons)`
from `StudentContext`. For verified (non-demo) learners the StudentProvider
deliberately supplies `scopedSnapshot(profile, [], [], [])`, so the tab falsely
showed **"no next lesson in demo"** even if the owner had real scheduled D1 lessons.
The dashboard and the lessons tab already used signed owner APIs. This is a
real UI inconsistency and a misleading empty state, not an environment issue.

## Fix
- Signed learners mount `StudentConnectedPreparation` keyed to the selected
  learner. The old fixture experience is retained exclusively in explicit
  preview/demo contexts and is unreachable under the canonical authenticated
  student shell.
- Read upcoming lessons from the same verified owner-scoped endpoint used by
  `/student/lessons`, with abort on account/profile switches, load/error/retry
  and exact learner-ID guard. Cancelled/completed/expired lessons are not
  presented; an in-progress signed live lesson is presented with the genuine
  room URL. A failed API is **not** displayed as an empty schedule.
- Reuse `StudentAcademicPlanCard` to present independently signed teacher
  plans. Plans remain distinct from published homework; homework and voluntary
  practice tabs are linked but never auto-submit/auto-complete a task.
- The live preparation never invents a teacher's name, a study assignment,
  an appointment or a payment. Student list, status and time are always
  derived from authoritative server rows.

## Verification and open acceptance
- Unit tests cover near/far/live/past/cancelled, sibling isolation and
  malformed learner/clock. Server-render test verifies a truthful first
  loading state rather than demo/false no-lesson.
- Verify via two actual guardians/sibling profiles on Cloudflare Dev, with
  a real scheduled lesson and actual signed teacher academic plan; review
  360x667, 390x844 and desktop RTL, keyboard and touch.
- Other closure blockers remain: multi-page homework focus view, R2 private
  student audio, full signed Admin and paid subscription ledger, WhatsApp
  opt-in, Dev classroom two-user durable ink and historical R2 archive.
  No production flag or remote D1 schema change is included in this PR.
