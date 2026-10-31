# #155 / #242 — Teacher portal: stale-source isolation across student/lesson switches

## Verified risk
The canonical connected teacher UI correctly verifies all sensitive writes
on Cloudflare Workers/D1. But several React components previously retained
the previous student's/lesson's `loaded` state for one render between
changing the selected ID and `useEffect` resetting/loading new source data.
This could temporarily display the old child's assignments/draft marks next
to the newly selected learner, or display a previous lesson report under a
different lesson heading; a fast click might attempt a mismatched write that
the backend would refuse. Client-side fail-closed behavior must complement,
never replace, server authorization.

## Fix
- `TeacherConnectedAssignments` attaches the fetched `learnerId` to the
  response state, uses rows only for that exact current learner, rejects
  mismatched `publish`, ignores a draft completion for the wrong learner,
  and clears form/draft/review state on switching. The selector is disabled
  while a publish is in flight.
- `TeacherConnectedPreparation` attaches exact `learnerId` to both
  ready and failed read state, hiding previous learner homework immediately
  when the lesson selection changes.
- `TeacherConnectedReports` records exact `loadedLessonId`, hides its
  prior report while the new selected lesson is not yet fetched, and
  disallows editing/POST before the current lesson's report is confirmed.
- All three retain signed API / DO/ D1 role enforcement and keep no
  fixture fallback. Public /teacher routes remain inside TeacherShell.

## Required staging acceptance
Use a Sheikh with two assigned learners, each with distinct draft ink and
published assignments, and two completed report lessons. Switch rapidly A→B
on the **same mounted page**, click potential actions during loading, and
verify no old student data shows, no wrong student/lesson write occurs, and
network failures never fall back to old state. Repeat on 360x667 mobile,
390x844 mobile, keyboard and desktop. Verify server 403/404 after teacher
assignment revocation. Do not activate a disabled production feature flag
until these signed Dev checks pass.
