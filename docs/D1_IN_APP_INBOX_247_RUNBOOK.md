# #247 — Real D1 in-app inbox (source-backed, no external messages)

## Delivered source surface
- Migration `0019_in_app_inbox.sql` adds immutable learner-scoped notification rows. D1 source triggers create a notice **only** for a verified actual assignment publication or lesson booking/change/cancellation/completion. No browser can synthesize a notice; no grades, recordings or private notes appear in message bodies.
- `GET /v1/teacher/inbox`, `POST /v1/teacher/inbox-actions`: verified qualified active Sheikh subject from Better Auth + D1, read/unread CAS with immutable read history.
- `GET /v1/me/learners/:learnerId/inbox`, `POST /v1/me/learners/:learnerId/inbox-actions`: verified owner and exact active learner, never sibling or unrelated account. Read source item and event latest revision from D1.
- New connected `/teacher/notifications` uses signed data and does not mount existing fixture-only `TeacherNotifications` component. Retains honest loading/error/empty states and no success if D1 write isn't confirmed.
- Source notice creation participates in the originating D1 transaction. Failure in source publication/booking rolls back associated notices; idempotency is the source event, not a separate fake alert.

## Privacy and constraints
- NOT connected to WhatsApp, SMS, email, push, outside schedules or Cron. No contacts, numbers, or media in the notification schema. **No WhatsApp consent or template policy has been implemented.**
- A previously generated historical notice remains immutable; API read access checks current active account/qualified Sheikh role, and owner learner ID. Guardian sibling isolation is still enforced.
- A signed API reader can be wired to the Student dashboard later; this milestone connects the teacher portal and establishes owner read/write API but does not claim student notification UI is finished.
- No server job producing 24h/1h reminders exists; no inference of provider delivery ACK. Keep issue #247 OPEN.

## Before staged rollout
1. Verify D1 migration 0019 and application-side schema-read checks in isolated Dev only; no production schema change in this PR.
2. Create a synthetic assignment and lesson, confirm source notices appear exclusively for verified owner/Sheikh and not unrelated child.
3. Mark read, reload, verify persistence and immutable CAS; parallel two-tab changes should yield 409.
4. Revoke teacher qualification/archive learner, verify 403/404; never expose sibling private data.
5. Run full scoped mobile/desktop RTL visual acceptance, then separately decide and implement WhatsApp guardian consent, approved templates, provider, Queue/Cron, deduplicated reminders, and delivery receipt handling.

## Rollback
Do not remove immutable tables to “clear notifications”; leave audit history. Route may be disabled on staging by removing feature deployment. No external message sending exists.
