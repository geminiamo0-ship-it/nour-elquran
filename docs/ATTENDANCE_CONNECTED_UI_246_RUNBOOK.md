# #246 Student + Sheikh attendance user interface — verified D1 and DO only

## What was wired
- `/teacher/cases` from the canonical signed TeacherReadOnlyView: verified roster and lessons; **only current teacher-authored D1 incident rows** are displayed. The Sheikh may report a **preliminary** student no-show on a scheduled lesson after 15 minutes, or connection interruption during a live lesson. A report is accepted only if authenticated Worker D1 grants and verified LessonDO teacher heartbeat confirm presence, and no-show is denied if the learner is present.
- `/student/lessons`: next to the actual lesson list, the **selected learner's D1 attendance cases** and one signed 7-day owner appeal, showing `under review`, `accepted` or `rejected` only from authoritative D1 joins. A sibling's records never belong in this profile.
- Shared `attendanceClient`: strict schema and exact URLs; no role, phone, child identity, presence boolean, charging, evidence file or teacher ID in a POST body. Every write needs confirmed server ACK **and a fresh D1 read** before a success banner. Ambiguous requests require refresh.
- This UI replaces the real teacher route placeholder and adds actual student case view; the older isolated `AttendanceWorkspace` fixture preview stays disconnected from the canonical authenticated route.

## Still not delivered
- No actual financial decision, no credits charged/refunded/compensation. Those require explicit separately approved staff controls tied to a verified entitlement ledger.
- No R2 evidence attachments, auto WhatsApp, admin dashboard front-end, actual Dev signed two-account lesson presence QA or mobile review.
- The message on the teacher's case list is a **preliminary report** even if the owner has not yet appealed; it does not claim an administrative verdict.
- Production stays unchanged; full #246 remains open until real teacher-owner-admin lifecycle and negative security tests succeed on Cloudflare Dev.

## Real acceptance to run
1. Sheikh opens scheduled lesson and joins signed LiveKit/DO waiting room; after 15 minutes with learner absent, report to D1, and reload case page. UI blocks immediate attempts but server is authority.
2. Test with learner present or unsigned teacher, forged/revoked role, other child's lesson — no report accepted.
3. Guardian selects that child, submits a 10–1000 character appeal before seven days. Restart/reload, verify same appeal and that child's D1 case; switch child and verify no leaked state.
4. Staff with `attendance.review` permission resolves via signed endpoint and owner sees decision; staff dashboard itself is pending.
5. Verify no cash/billing/entitlement table touched; check two-tab/idempotency/network-uncertain behavior.
