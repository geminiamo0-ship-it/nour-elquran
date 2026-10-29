# Interactive classroom preview → authorized runtime contract (#50, #120)

**Status:** implementation design and React preview, NOT a connected LiveKit room, student/teacher session, streaming sync or durable saved lesson. Parent decisions: #7, #14, #18, #49, #50 and #120. Date: 2026-10-29 (Africa/Cairo).

## 1. Frontend architecture

- `/classroom`: explicitly public **synthetic** classroom test/demo. It must never accept a lesson ID and then pretend that accessing this URL grants any teacher or learner permission.
- `features/classroom/ClassroomPreview.tsx`: orchestration around the *original* printed Quran renderer, imported from the student feature's public index. Do not create a duplicated Quran image component, alter canonical Quran SVG text or infer word anchors.
- `ClassroomControls.tsx`: prejoin simulated two-party presence, explicit teacher Start/End with confirmation; teacher-only page navigation, drawing mode, marker, eraser and roles/mute controls. Clock slider is preview data ONLY. 30m/40m thresholds issue warnings but **never auto-end**, even beyond 40m.
- `ClassroomMedia.tsx`: placeholder video tiles, student docked on the teacher view with movable/resizable floating alternative, separate teacher self-preview hide vs camera-off. No camera requested and no actual LiveKit connection.
- `ClassroomSidePanel.tsx`: per-ayah error notes (حفظ/تجويد/نطق/إعادة تسميع), teacher-private notes, three independent 0..10/null grades and local shared mark hide audit. Student sees no teacher-private draft or another learner's data.
- `useClassroomPreview.ts` + `domain.ts`: UI-only policy and deterministic data shapes; eventual production role must originate from verified Better Auth session and authorized Lesson DO membership, **not** from the role selector in this demo.
- `Classroom.module.css`: Arabic RTL responsive Quran-first layout. Mobile must keep Quran usable; student video can be docked or floated without covering Qur'an by default. Keyboard/pointer/mobile stylus test gate.

## 2. Mandatory durable room protocol before a real lesson

1. Worker verifies authenticated account/child learner or qualified acting teacher, lesson ID, booked learner and granted teacher, guardian-accepted substitute and active dates. Public preview never reveals live room identity.
2. Worker issues a short-lived **per-lesson LiveKit Cloud A/V token** after permission checks; NEVER send API signing credentials to the browser. LiveKit is A/V only; actual Quran state is authoritative in a per-lesson **SQLite Lesson Durable Object**.
3. Presence: both verified participants must be connected in the waiting room to enable and commit Sheikh Start; actor is the assigned Sheikh or accepted substitute, verified from the DB. Student, absent Sheikh, absent student, late/expired substitute, revoked sessions and stale room requests cannot Start. Presence is not equal to an enabled microphone or camera.
4. Start/End are authenticated teacher actions with idempotent request IDs and server UTC timestamps persisted and reconciled into D1 immutable lifecycle events. Only Sheikh manually Ends; **no timer**, participant disconnect, media provider room idle event, browser close or next booking auto-ends. At most one currently live lesson per teacher and learner, even with consecutive 40m reservations.
5. DO room state is the authority for `edition`, `page`, `drawingPermission`, `micModeration`, author-attributed shared ink and ayah-linked error operations. Every event uses unique `opId`, server `seq`, lesson/actor and stable Quran edition/page/ayah target. Persist before ACK; replay snapshot plus tail on WebSocket reconnect after authenticating again. Don't write each pointer movement to D1.
6. The Sheikh alone changes shared Quran page. Both participants can ink by default, and Sheikh can temporarily pause learner shared drawing without removing previously accepted ops; Sheikh may hide learner's SHARED stroke with immutable tombstone/audit, never access private student notes. Learner can erase only own shared marks. An ink operation begun on the old page cannot silently attach to new page.
7. Teacher can mute student with verified server-side media moderation, but remote unmute and automatic microphone activation are forbidden. Student explicitly enables own mic when teacher releases the restriction. Video self-preview hide is local, **not** camera-track off.
8. Time: booked `starts_at_ms` and `ends_at_ms=starts+40m` are immutable schedule fields, independent of `actualTeacherStartAt` and manual `endedAt`, 30-minute instructional target, and overrun alerts. Late student >15m may still join and Sheikh may choose to Start; student no-show report is provisional. Sheikh delayed +5/+10 alerts admin, student after >10 may exit and request admin-reviewed makeup, never automatic absence/credit deduction.
9. Worker/D1/R2 publication: after explicit End, seal lesson operations and draft report separately. Teacher edits and publishes a versioned report with independent `hifz`/`recitation`/`tajweed` nullable grades. Only APPROVED teacher marks/notes and latest approved report are shown to learner notebook/training, never any draft. Use private R2 for sensitive archives and distinct explicit learner-assigned audio submissions (not routine class A/V recordings).

## 3. Production APIs and data contract, not implemented here

| Route / stream | Requirement |
|---|---|
| `GET /v1/lessons/:id/lobby` | verified attendance identity, waiting state, real device check state, no fake presence |
| `GET /v1/lessons/:id/realtime` (WS) | server-authorized upgrade, sequenced DO replay, revoke on logout/lesson reassignment/end |
| `POST /v1/lessons/:id/start` | Sheikh only, **both present**, conditional unique transition + audit; no client role/presence claims |
| `POST /v1/lessons/:id/end` | Sheikh only, manual at any time, idempotent; report-pending + archive outbox |
| `POST /v1/lessons/:id/media-token` | scoped LiveKit participant tokens, no signing secret returned |
| `POST /v1/lessons/:id/moderate-microphone` | verified teacher mute/release only, NEVER remote unmute |
| `GET /v1/lessons/:id/snapshot?afterSeq=N` | authenticated page/ink/error snapshot and tail, no student private layer |
| `GET/PUT /v1/teacher/reports/:id/draft`, `POST .../publish` | version and student-visibility controls, immutable last published pointer |

## 4. Scenario-to-test matrix

- Teacher first / learner first / both present: Start only on teacher and after both connected; disconnect between eligibility check and click denies Start; reconnect doesn't cause an implicit End.
- Teacher delayed T+5 and +10, learner absent T+15, learner arrives T+18: operational case records and alert policy, no automatic financial penalty.
- One teacher scheduled 18:00–18:40 and 18:40–19:20: bookings adjacent; overrun must warn and leave second lesson waiting, NEVER silently end first at 18:40 or overlap two live rooms.
- Two roles drawing simultaneously, learner editing paused midway, teacher hides shared learner mark: durable sequence and audit, private learner notes remain unreadable and untouchable.
- Teacher changes Quran pages with pending ink; chapter/ayah metadata only from verified canonical source, all 604 pages tested under zoom/portrait/stylus.
- Student mic was muted: no teacher unmute and no student mic-on while restricted; student must click mic-on after release.
- Video side dock/float/resize and teacher hide-self-preview separate from camera track switch; test denial of device permissions, audio-only fallback and network loss.
- Sheikh End then draft saved; report unpublished stays teacher-private, publish requires explicit action; revision later doesn't replace historical approved snapshot.
- Substitute accepts by authorized guardian: limited lesson-specific prep and room; access revoked immediately at actual manual End; separate report amendment 24h after first publication.
- No real data or secret in fixtures; bad role/cookie/token/WS connection and cross-sibling attempt denied; failures cannot masquerade as saved/published content.

## 5. Release gates

Run exact-head GitHub CI: TypeScript strict, Vitest, architecture boundaries, full Next build, Chrome at 360/390/1440 with camera/mic mock indicators, and isolated native Cloudflare D1 smoke. Then real two-device Cairo/Egypt network, LiveKit token expiration/revocation, DO crash/replay and private R2 archive integration before claiming the class works. No deployed live functionality or LiveKit Secret is part of this PR.

**Next coding after preview:** authorized Lesson DO authenticated two-client presence plus Worker session-backed Start/End, then LiveKit token/SDK, actual shared annotations, report archive and homework. Do not promote the demo role switch to an authentication mechanism.
