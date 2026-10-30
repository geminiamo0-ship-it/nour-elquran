
# Student + Sheikh portal zero-mock audit — 2026-10-31
Baseline main: a25bedd3337a3d6ba17de435301545bc9829294e. Scope: actual Next.js routes, live feature wrappers, shared signed API clients and Worker dependencies. Master #155 / owner issue #242.

## Student route audit

| Route | Backing data | Verdict |
| --- | --- | --- |
| /student | Previous StudentContext for real account returned scopedSnapshot(profile, [], [], []) — ALL counters empty despite real data. Candidate ConnectedStudentDashboard now fetches actual lessons, assignments, reports, and separate academic plan. Network errors never become fake empty state. | Candidate fix |
| /student/lessons | ConnectedClassroomLessons -> notebookClient.lessons, signed D1; lesson room real. No available-slot/free-trial booking API. | Real read; booking blocked |
| /student/mushaf | MadinahReader -> own saved annotations/notes API with page media | Connected; device QA needed |
| /student/training | StudentPublishedAssignments signed teacher tasks, StudentAssignmentSubmission text review/attempt real. TrainingVoicePractice only device-local; no R2 upload. | Partial; audio blocked |
| /student/progress | ConnectedProgressReports -> approved revisions from lessonReportsClient.student | Real reports; attendance blocked |
| /student/notebook | ConnectedNotebookWorkspace -> completed lesson and private notes, published report | Real; sealed PDF/PNG export blocked |
| /student/subscription | Old stageCopy from hardcoded new state incorrectly implied no subscription. Candidate shows entitlement as UNKNOWN pending signed ledger. | Finance blocked, false claim fixed |
| /student/account | AccountProfiles -> Better Auth and owned learner actions | Connected |

## Teacher route audit

| Route | Backing data | Verdict |
| --- | --- | --- |
| /teacher | TeacherReadOnlyView -> signed teacher roster and D1 timetable. | Real core |
| /teacher/students | TeacherConnectedStudents and TeacherAcademicPlanEditor -> authorized roster and D1 versioned plan. | Real core |
| /teacher/schedule | signed D1 lesson timetable and actual scoped /classroom/live link | Real core |
| /teacher/preparation | Previously generic unconnected fallback. Candidate TeacherConnectedPreparation -> real upcoming lessons, academic plan and published assignments. | Candidate fix |
| /teacher/assignments | TeacherConnectedAssignments and TeacherAssignmentReview -> real signed publication and text feedback | Partial: no teacher audio playback |
| /teacher/reports | TeacherConnectedReports -> existing signed D1 report draft, 3 distinct grades, manual publish | Connected |
| /teacher/notifications | Live route previously generic fallback; fixture-only TeacherNotifications not live | BLOCKED: no persisted inbox, Cron or WhatsApp |
| /teacher/cases | Live route previously generic fallback; fixture-only TeacherCases not live | BLOCKED: no attendance and appeal backend |
| /classroom/live | Signed LiveKit, DO Quran sync, D1 Start/End corrections reports | Full isolated synthetic Dev PASS run 41140055151; owner visual UX not accepted |

## Zero-fixture contract
- Real /student requires Better Auth and verified learner. When account feature is unavailable, fail closed rather than mount demo StudentProvider.
- Real /teacher requires Better Auth and teacher backend; no anonymous fixture preview or scenario selector in canonical route. If service unavailable, fail closed, not fabricate teacher roster.
- Teacher navigation never points to /classroom design demo. A real lesson permits a session-specific /classroom/live link.
- Legacy fixture source modules may remain for isolated unit tests; they MUST NOT be reachable from canonical Student/Teacher routes.
- All absent providers must show unavailable without optimistic success, invented balances, fake attendance, fake notifications or assignment recordings.

## Outstanding blockers — cannot claim full integration
1. True trial booking/slot allocation, teacher assignment, six-hour cancel, rescheduling, entitlements.
2. Per-child financial/subscription ledger and approved provider payments; no inferred balance/date.
3. Private R2 voice upload, teacher playback/feedback and immutable resubmissions.
4. Attendance evidence, incidents, no-show, seven-day appeals and staff approvals.
5. In-app notifications and opt-in WhatsApp, queue/outbox/Cron, 24h and 1h.
6. Sealed Quran post-lesson archive, PDF/PNG authorized export, restore.
7. Admin roles, teacher invites, activation, substitute and supervision.
8. Actual mobile/tablet/desktop human UX and authorized cross-role tests after features are wired.

## Completion standard
Do not close #242 or Master #155 until every route has real API/permission traces, explicit error/loading/empty states, backend ACK for every write, no demo paths, reload preservation, cross-sibling and teacher isolation, Dev QA with evidence and honest blocked third-party dependencies. No Production changes.
