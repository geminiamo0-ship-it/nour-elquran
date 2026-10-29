# Noor Al-Quran — Student Portal A–Z implementation roadmap

**تحديث المالك 29 أكتوبر 2026 — #104:** اعتماد Cloudflare بالكامل وفق [ADR 0004](adr/0004-cloudflare-only-platform.md). D1 وWorkers مع تفويض خادمي بدل Supabase/PostgreSQL/RLS، وRealtimeKit هدف الحصص بدل LiveKit بعد الاختبار. مرحلة الباك إند بدأت بنواة محلية؛ التسجيل والحفظ والتزامن الحقيقي غير موصولين بعد. قرارات فصل المصحف/تدريباتي/الدفتر وخصوصية الطالب تبقى كما هي. إشارات المزود وتأجيل بدء الباك إند أدناه تاريخية ولا تتغلب على هذا التحديث.


**Owner direction:** Finish the student portal before starting teacher or administration frontend.
**Product authority:** [Approved requirements #3](https://github.com/geminiamo0-ship-it/nour-elquran/issues/3), [student implementation #44](https://github.com/geminiamo0-ship-it/nour-elquran/issues/44), [signup #43](https://github.com/geminiamo0-ship-it/nour-elquran/issues/43), [classroom #7](https://github.com/geminiamo0-ship-it/nour-elquran/issues/7).
**Baseline:** merged PRs #69 and #70; main `cee86d70`. These are mock React components, not real auth/payment/lesson/recording services.

## Universal acceptance rules
- Modular Next.js App Router, React, strict TS, native JSX, public feature index, typed domain adapters; no HTML injection.
- One adult account with multiple independent learner profiles; **no separate parent dashboard**. UI isolation is not server authorization; real data requires Auth/RLS before launch.
- RTL Arabic, dark olive/gold/ivory, mobile 360/390/768/1440, keyboard/focus/reduced-motion, honest empty/loading/error/permission states.
- Only last approved teacher report version per lesson; memorization/recitation/tajweed 0–10 independently, null is not zero. No overall score or academic charts.
- Canonical Quran text, fixed-page geometry and recitations **only from verifiably licensed authoritative sources** with accurate ayah/page/word identifiers. Preserve text immutable; annotations are separate.
- Homework checkboxes are local activity, not submission or teacher evaluation. Notes, audio and other student artifacts are private until explicitly and narrowly shared with authorized teacher.
- Mock bookings/assignments/payments/reminders/appeals never claim actual server success. Confirm real services only with protected backend transactions and independent evidence.
- Every slice: approved issue and focused PR, test assertions (unit + HTTP + Chrome), exact-head green CI, screenshots and docs/handoff. User review of visual decisions where appropriate.

## 16 ordered delivery slices
| ID | Frontend slice | Definition of done | External gate |
|---|---|---|---|
| **S01** | **Academic report history** | RTL semantic table, newest first, latest publication per lesson, independent nullable /10 scores, inline row expansion, `عرض المزيد` only, no filters/charts | Existing mock contracts |
| S02 | **Attendance and appeals** | Status counters + lesson ledger (attended, absent, canceled, rescheduled, review), 7-day appeal with reason and optional evidence, review-state UI, explicit no-server-warning | Teacher/admin adjudication + file authorization before production |
| S03 | **Trial and timetable** | 30-min free single trial after signup, qualified auto-teacher assignment workflow, weekly scheduling, real-slot/pending/error/cancel/reschedule 6h state diagrams | Authorized availability/booking RPC |
| S04 | **Quran reader** | Madinah fixed-page default and ayah-by-ayah alternative, verified canonical source, surah/juz/page/ayah jump and unified search, safe anchored navigation | Edition/page geometry/rights |
| S05 | **Reader continuity** | Per-learner page + ayah bookmarks, resume last reading, focus mode, optional visibility of personal marks | S04, scoped persistence |
| S06 | **Quran annotation tools** | Pen, highlighter, eraser, undo/redo, ayah notes, manual pen vs scroll, S Pen/mobile support, overlays separate from Quran text | Canonical page/word alignment |
| S07 | **Memorization test** | Conceal verse/word, selectable level, reveal and retry; absolutely no formal teacher score | Verified word anchors |
| S08 | **Recitation player** | Reciter/range/repeats/speed, listen→repeat timed or manual, persistent mini-player + mobile bottom sheet, safe stop | Licensed timed audio assets |
| S09 | **Self-recitation recorder** | Explicit mic permission, private recordings/playback/discard, selective teacher share with confirmation, teacher text/voice reply view | Consent, private storage, assigned-teacher auth |
| S10 | **Homework/reviews** | Teacher-approved vs self-study, due dates, required evidence, drafts, explicit preview→submit, late marker, teacher changes and immutable resubmission versions | Secure idempotent submission + teacher service |
| S11 | **Lesson notebook/archive** | Read-only approved teacher annotation snapshot + separate personal overlay, layer toggles, deliberate selected sharing, PDF variants | Signed immutable media/PDF backend |
| S12 | **Subscriptions & credit** | Fixed lesson-count packages, rolling per-child month, manual renewal, transaction/credit/makeup states, protected non-expiring academy makeups | Owner-approved prices and PSP, ledger |
| S13 | **Notifications** | Per-student inbox/read-state, class reminders 24h+1h, homework/reports, guardian WhatsApp opt-in and sibling grouping | Provider templates and async scheduler |
| S14 | **Family settings & teacher** | Signup, child profile identity, guardian verification state, personal settings, primary Sheikh, admin-mediated change requests | Supabase Auth/RLS, roles |
| S15 | **Classroom entry** | Pre-class/waiting/join/reconnect/permissions states; link to approved lesson archive; no live session recording | Signed LiveKit token and verified appointment |
| S16 | **QA and release** | User flow E2E, four responsive widths, RTL/keyboard/stylus/a11y, error/no-network, cross-sibling privacy tests, review screenshots and actual deployment evidence | Staging and sign-off |

## Delivery waves
- **Wave A (S01–S03):** correct reports, add attendance and trial/booking frontend.
- **Wave B (S04–S09):** complete reliable reader, annotations, audio and self-recitation (license/consent gates).
- **Wave C (S10–S11):** homework, report correction/resubmission, notebook/archives.
- **Wave D (S12–S15):** subscription, per-student reminders, family settings and class entry.
- **Wave E (S16):** accessibility, network failure, security, regression and deploy validation.

## S01 detailed acceptance
- Academic history in `apps/web/src/features/student/components/ProgressWorkspace.tsx` uses `<table>`; no cards/filters/charts.
- Columns: lesson/date, حفظ, تلاوة, تجويد, report. Keyboard-operable expand button with `aria-expanded` and `aria-controls`; expanded detail row comes immediately after the selected lesson.
- Latest published report per `lessonId`; sorted newest first, stable ties; a page shows five rows until `عرض المزيد` is activated. No old private revisions, no fabricated records or Quran archive links.
- New learner empty state, and reselecting a sibling resets page and expansion; cross-profile report leaks are forbidden.
- Unit, Next production build, Chrome route and interactions, responsive screenshots. Existing source mocks stay explicit.
- **Implementation:** PR for branch `feat/44-student-az-reports-s01`, refs #44. Do not mark done until green and merged.

## Dependency and verification policy
- S01–S03 may use typed mock-only UI where no database exists. S04/S08 canonical Quran/audio require source evidence before genuine media claims. S09 consent/privacy and S12 payments must not simulate successful upload or purchase as real. Production-only flows are explicitly backend-gated.
- After each PR record: issue, exact head, tests, merge SHA, what is real/mocked, UI screenshot review, remaining blocker and next slice.
- Next strict task once S01 is merged: S02 attendance counts, register and 7-day appeals. Teacher is authoritative for presence; admin can review and correct, not the student.

