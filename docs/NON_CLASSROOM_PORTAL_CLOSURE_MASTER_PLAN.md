# نور القرآن — خطة إقفال جميع الواجهات الحالية (باستثناء Classroom)

**الحالة:** خطة تنفيذ وتعريف قبول، **وليست تصريحًا بأن الوظائف مكتملة**.  
**المصدر الذي جرى تدقيقه:** Noor `main@cfacdd602ada2f7ef0364b7b7ec67a5a96af6df3`، 29 أكتوبر 2026.  
**التتبع الرئيسي:** [#155](https://github.com/geminiamo0-ship-it/nour-elquran/issues/155)، وتتصل به خطط [#142](https://github.com/geminiamo0-ship-it/nour-elquran/issues/142) و[#44](https://github.com/geminiamo0-ship-it/nour-elquran/issues/44) و[#45](https://github.com/geminiamo0-ship-it/nour-elquran/issues/45).  
**البنية المعتمدة:** Cloudflare Workers + D1 + R2 + Queues/Cron + Better Auth؛ التطوير على **الرابط المفتوح القائم** `noor-site-staging` مع D1 `noor-core-staging`، **بلا Worker QA منفصل وبلا كلمة سر Dev إضافية**. لا يغير شيء في Production أو Santo.

## تنفيذ المرحلة 01 — الحالة الحالية (2026-10-29)
- **01A إدارة ملفات الطلاب:** [Issue #157](https://github.com/geminiamo0-ship-it/nour-elquran/issues/157) — **PASSED على Cloudflare Dev**: [Noor Verify 40958071853](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40958071853) + [Santoreno remote Chrome/D1 40958341460](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40958341460)، تعديل/أرشفة/CAS/عزل الإخوة وسجل محفوظ؛ **01A ACCEPTED STAGING ONLY**. تحسين الهيدر المحمول في #160، وهوية ولي الأمر/OTP وإعداد الشيخ لا تزال مفتوحة. لا يُعد نجاح Merge/CI بديلاً عن Staging E2E، ولا توجد موافقة نهائية على OTP أو موافقات القُصّر.
- **باقي 01**: تحقق الهاتف، الاستعادة، الموافقات، جلسات الأجهزة، وتأهيل الشيخ بمسار الإدارة والاختبارات الحقيقية لم تُغلق.
- **02–12:** كما في المصفوفة التالية؛ لم تنتقل إلى CLOSED بسبب عمل 01A.

## 0. النتيجة النهائية وحدودها

نريد تحويل **كل صفحة حاليًا في `/` و`/student/*` و`/teacher/*`** من واجهة تجريبية إلى رحلة فعالة مترابطة، لا تختلق حجزًا ولا تقريرًا ولا حالة حفظ، وتحتفظ ببيانات كل متعلم على الخادم حتى بعد Refresh/تسجيل الخروج والعودة أو جهاز آخر. لا نخلق لوحة مستقلة لولي الأمر، ولا صفحة «خطة» جديدة للطالب.

**Classroom / `/classroom` خارج هذه الخطة بالكامل:** اتصال الصوت والفيديو (LiveKit)، دخول الغرفة والمشاركين، LessonDO لقلم الحصة المشترك والتنقل اللحظي، Start/End، heartbeat/reconnect، الصوت المباشر، وأرشفة Snapshot الحصة من DO. هذا برنامج منفصل، بمهام وإثباتات مستقلة. **لكن** تقارير الحصص ودفتر الحصص والحضور هنا يجب أن تكون قابلة للاستخدام فور وصول أحداث/أرشيف معتمد من ذلك البرنامج. نختبر استقبال عقود تلك الأحداث ومرفقاتها ببيانات *اصطناعية موثقة* ولا ندعي أن الغرفة الحية تعمل.

تقسيم الوظائف المعتمد:
- **الشيخ / طلابي:** الملف الأكاديمي وخطة الحفظ والمراجعة، بإصدارات وسجل تعديلات. لا يعني تغيير الخطة تلقائيًا تسليم واجب.
- **الشيخ / الواجبات والتسميعات:** إنشاء الواجب ونشره لطالب/طلاب، استلام المحاولات الصوتية وتصحيحها.
- **الطالب / تدريباتي:** `واجباتي` المنشورة، `الحفظ والمراجعة` الحرة، `الاستعداد للحصة`. لا تُنشأ صفحة «الخطة» إضافية.
- **الطالب / المصحف:** 604 صفحة من المرجع الموثق، علامات وملاحظات ومفضلة وموضع القراءة *الشخصية الخاصة*، منفصلة عن بيانات الشيخ.
- **الطالب / دفتر الحصص:** *ما حدث* في حصص سابقة؛ آخر تقرير معتمد، آيات الحصة، وملاحظات الطالب الخاصة، ومتى يتوفر أرشيف العلامات المعتمد. نفس Renderer للقرآن، لا نسخة ثانية.
- **الطالب / تقدمي وتقاريري:** سجلات وتقارير الشيخ المنشورة فقط، درجات حفظ/تلاوة/تجويد مستقلة `0..10` أو `null`، دون اختلاق متوسط إجمالي.
- **الحجز والاشتراك:** مواعيد وتكلفة/رصيد مرتبطان ببيانات معتمدة، لا اقتطاع ولا حجز من مجرد تغيير واجهة.

## 1. الجرد المراجع: ما نملكه الآن وما لا يجوز ادعاؤه

| النطاق | الموجود فعلًا في `main` / Dev | الفجوة |
|---|---|---|
| الهبوط `/` | صفحات تسويقية/نماذج، التسجيل المتصل عند `NEXT_PUBLIC_ACCOUNT_UI=true`؛ Demo modal باقٍ للمعاينة | رحلة تسجيل متماسكة، محتوى وأسعار/سياسات معتمدة، إغلاق انتقالات Demo إلى الخدمات الفعلية |
| الحساب `/student/account` | Better Auth وGET/POST profiles وحتى 8 متعلمين؛ دورات login/logout/session في Staging | إثبات ملكية الهاتف، الاستعادة، التعديل/الأرشفة وسياسات موافقات ولي الأمر وإعدادات الخصوصية |
| المصحف `/student/mushaf` | **مفعّل على Dev**: `NEXT_PUBLIC_QURAN_PERSISTENCE_ENABLED=true`. Santoreno [run 40948945588](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40948945588) أثبت pen/marker/note/bookmark وقراءة D1/hide/restore ورفض الحساب الآخر، وتحقق من 6236 مرسى آية | اختبار Pointer/Touch واقعي بعد Refresh وجهازين؛ مقاومة انقطاع ما قبل ACK؛ pagination، S Pen، استمرارية قارئ الصوت |
| بوابة الطالب وصفحات الدروس | React state + fixtures للعرض؛ الحساب المتصل عادة `scopedSnapshot(profile, [], [], [])` | الجدول والتكليفات والورد والخطة والرصيد والتقارير والحضور من API فعلي |
| `/student/training` | واجبات وتجهيز/تسميع محلي، `MediaRecorder` محلي لا يرفع | المهام المعتمدة والتسليم ورفع R2 والتصحيح والتاريخ |
| `/student/progress`, `/student/notebook` | عرض تاريخ تجريبي + ملاحظات محلية | أحدث تقرير منشور، شخصي/معتمد منفصل، أرشيف وصادرات |
| `/student/subscription` | حالة/رصيد/فواتير توضيحية، لا معاملة مالية | باقات/رصيد/دفع/إيصالات/استرجاع آمنة |
| `/teacher/*` | واجهة كاملة متعددة السيناريوهات كلها تقريبًا من `TeacherContext` fixtures؛ teacher read-only adapter B1 خلف flag غير مفعّل في build المعتاد | تأهيل/مصادقة الشيخ، home/roster/calendar الحقيقي، ثم APIs الخطة والواجبات/الصوت/التقارير والحضور والإشعارات |
| Backend B1/B2/B3 | `GET /v1/teacher/learners`, `GET /v1/teacher/lessons`, owned learner timetable؛ staff role/scheduling actions مع D1 migrations 0001–0006 | ربط UI للشيخ بـDev بعد تأهيل حساب تجريبي وتحقق صلاحيات؛ عقود كتابة المجالات التعليمية غير منفذة |
| Classroom | صور UI وتجربة تفاعلية فقط | **خارج الخطة**، ولا يسمح بإظهار أنها حصة حقيقية |

## 2. قاعدة إقفال موحدة لكل صفحة

لا تُغلق أي بطاقة/صفحة إلا بعد تحقق **كل** شروطها ذات الصلة:
1. **UI**: جميع الأزرار والروابط والفلاتر والنوافذ والبحث والتنقل والـRTL والموبايل تعمل؛ لا زر ظاهر بلا إجراء أو حالة تعطيل صادقة.
2. **API**: طلب/رد Typed ومتحقق منهما، رفض server-side للحقول الزائدة، timestamps UTC/عرض القاهرة؛ أخطاء موحدة `401/403/404/409/422/429/503`، requestId وتكرار آمن.
3. **D1/R2**: حفظ حقيقي لا يصبح «محفوظًا/منشورًا/مدفوعًا» قبل ACK. إصدارات CAS أو idempotency، إعادة فتح ناجحة بعد Refresh ومن جهاز آخر. لا بيانات مالية أو صوت/درجات في fixtures للحساب الحقيقي.
4. **هوية وخصوصية**: الجلسة موقّعة، `accountId + learnerId + teacherAssignment + role + time` يتحقق منها Worker في كل قراءة/كتابة؛ لا تسرب شقيق/معلم سابق/بديل/رابط R2 عام. التغيير أثناء الطلب يلغي النتائج القديمة.
5. **حالات كاملة**: first-use zero، empty، loading، success، pending، failed/offline، expired، permission denied، conflict/retry، deleted/archived، وقابلية الوصول.
6. **دليل نشر**: unit/SQL + Worker/D1 local + E2E على **Dev الموجود** بحسابات صناعية مستقلة؛ صور 360×667 و390×844 و768×1024 و1280×900 و1440×900؛ عدم وجود scroll خارجي قسري في واجهات القراءة المناسبة؛ Safari/Android/Firefox قدر الإمكان، اختبار S Pen الفعلي على الجهاز يدويًا.
7. **تشغيل**: logging بلا بيانات أطفال/صوت/هواتف، queue/outbox، alert، rollback غير هدّام، backup/restore للبيانات الجديدة، مصفوفة توافق migrations، documentation/handoff وأدلة GitHub.

**حالات رسمية دنيا:** `draft → saved → submitted/published` حيث تنطبق، مع مراجعات وعدم تحريف المصدر؛ العميل لا يحدد التاريخ الرسمي أو الدور أو الرصيد.

## 3. مرحلة 00 — الجرد والعقود والبنية الأساسية (اعتماد قبل الوظائف)

- توثيق **كل route وكل زر** `Landing + Account + Student + Teacher`: مصدره الحالي fixture/local/D1/R2، الجهة المخولة، الـAPI المطلوب، ما يحصل عند فقد الاتصال، ونقطة استلامه من Classroom إن وجدت.
- تنظيف نصوص `PROJECT_STATUS` وrunbooks التاريخية التي تذكر Supabase أو حماية Dev بكلمة مرور أو «Quran UI OFF» بعدما تغيرت الحقائق، دون حذف سجل القرارات؛ ADR 0004 + ADR 0007 هما مرجع البنية المعتمد.
- نظام عقود DTO موحد versioned، time/validation/auth/409/idempotency، إعداد D1 migrations الإضافية فقط، private R2 bucket + prefix scoping، Queue/outbox، feature flags **على نفس Dev**، إعداد synthetic fixture issuer مسيطر عليه، عدم اختلاق مستخدم.
- ربط كل slice بمهمة GitHub، PR ودليل، مع tracker يبين حالة `not started / in progress / API proven / UI proven / closed`.
- **قبول:** تقرير baseline لكل route وAPI/SQL inventory وactor-access matrix؛ smoke موجود لا ينكسر؛ لا أسرار Cloudflare أو هواتف حقيقية في artifacts.

## 4. مرحلة 01 — الهوية والحسابات والعائلة والصلاحيات

**الواجهات:** Landing registration و`/student/account` وكل switch/session UI، مدخل الشيخ.

- Better Auth login/register/logout/session/cookie الموجود؛ اكتمال **التحقق من ملكية الهاتف** وإعادة تعيين كلمة المرور وتقييد المحاولات؛ اختيار مزوّد OTP عند تفعيل المستخدمين الحقيقيين. لا نعامل `phone_verified=false` على أنه موافقة ولي أمر.
- حساب أسرة واحد حتى **8 ملفات طلاب مستقلة**؛ إنشاء/اختيار/تعديل الاسم والعمر التعليمي المناسب/أرشفة بدل محو سجل الحصص؛ التبديل يمنع فقد pending، يلغي fetch ويرفض قراءة بيانات الأخ.
- تأكيد موافقات ولي الأمر لملفات الأطفال والصوت/المشاركة/WhatsApp، مراجعة/سحب الموافقة وسجل وقت/نسخة السياسة؛ تغيير رقم، تفضيلات الاتصال، جلسات الأجهزة، حذف أو تصدير وفق السياسة القانونية المعتمدة.
- **تهيئة الشيخ بواسطة staff فقط**: provision→qualify→activate→suspend، عدم صلاحية teacher من مجرد signup. حدود البديل: لا roster دائم ولا ملاحظات شخصية؛ عرض ما يخص الحصة المصرح بها فقط بالمدة المعتمدة.
- **قبول:** مستخدمان مستقلان وأخَوان داخل مستخدم واحد، جلسة منتهية، تسجيل خروج/إعادة تشغيل، duplicate request، صلاحية شيخ مسحوبة، 401/403/404 حقيقية، لا user-data fallback إلى fixtures.

## 5. مرحلة 02 — «طلابي» والخطة الأكاديمية + الرئيسية المشتركة

**الواجهات:** `/teacher`, `/teacher/students`, `/student` ولوحة الورد.

- تفعيل adapter `TeacherReadOnlyView` للمعلم المؤهل على Dev دون جعل صفحة الشيخ Demo تبدو حقيقية؛ تحويلها تدريجيًا إلى مكونات connected فعلية لكل route بدل استبدال portal كله بلوحة read-only عامة.
- Teacher home query: عدد الطلاب الحاليين، المواعيد/البلاغات/الواجبات/التقارير القادمة، Counts محسوبة من D1؛ بحث وفرز وpagination؛ roster assignment/active intervals مع teacher access.
- `learner_academic_plans` و`plan_revisions` (اقتراح جداول جديدة بعد مراجعة migrations): مستوى الطالب وتاريخ حفظ/تلاوة معتمد، current memorization target + revision target + next wird + ملاحظات الشيخ؛ `GET/PATCH` مع `expectedRevision`, immutable before/after and actor time. لا نشر واجب تلقائي.
- صفحات الطالب home/Wird/readiness تستهلك الخطة الفعلية، تظهر «لا خطة منشورة بعد» بصدق، مع روابط `تدريباتي`/المصحف. الشيخ غير المسند لا يطلع ولا يعدّل.
- **قبول رحلة:** staff يسند الشيخ ← «طلابي» يعرض طالبًا واحدًا ← الشيخ يعدّل خطة الطالب ويحفظ ← الطالب يرى الورد على Dev وجهاز آخر ← شقيقه لا يرى الخطة ← معلم آخر 404 ← تعديلان متزامنان 409 واضح، لا فقد.

## 6. مرحلة 03 — الجدولة والتجربة الأولى (قبل الاشتراكات المدفوعة)

**الواجهات:** `/student/lessons`، `/teacher/schedule`، لوحة اليوم، `/teacher/preparation` للجزء المتاح.

- مصدر available slots حقيقي من staff qualifications, assignments, calendar, conflict rules؛ عرض timezone القاهرة + UTC داخليًا، DST, booking availability وrefetch قبل تأكيد، مُعرّف طلب آمن.
- **حصة التجربة**: أهلية single-use تتحقق من الخادم، بدون افتراض مقاعد أو شيخ؛ التفضيلات ليست حجزًا؛ عملية حجز/تأكيد حقيقية بسجل D1. مدتها/سعرها يتبعان سياسة المنتج المعتمدة، ولا نخلط «وقت التعليم المستهدف 30 دقيقة» بفترة الحجز **40 دقيقة**.
- `staff/schedule-actions` الحالية للنطاق الإداري، تضاف owner-facing booking workflow بعزل role/eligibility، مع assign qualified teacher بقرار مدقق (قد يتطلب staff coordination؛ لا browser-created teacher). الحد الطبيعي للإلغاء **قبل 6 ساعات**؛ تعديل متأخر قرار إداري مستقل؛ reschedule ذرة واحدة أو compensating transaction دون duplicate slots.
- جدول الشيخ والتلميذ يظهر same booking; statuses scheduled/cancelled/rescheduled/completed، تكرار calendar من D1؛ التحضير يقرأ الواجب والتقرير المعتمد إن وجدا ولا يخترعهما. أزرار انضمام الحصة فقط عقد handoff للـClassroom.
- **قبول:** two users race for last slot → واحد فقط؛ guest لا يحجز؛ حق تغيير الموعد/تأكيده واضح؛ cancellation ينتج حالة D1، لا «حجز وهمي»، وتجديد الصفحة يُعيد نفس الموعد.

## 7. مرحلة 04 — الاشتراك والرصيد والدفع (ثم حجز الحصص المتكررة)

**الواجهات:** `/student/subscription`, حجز حصص الباقة وتجديدها.

- قرار باقات ورسوم وخصومات وPSP/fiscal invoice/return policy **يعتمده المالك قبل الدفع الحقيقي**؛ هذه ليست أسعار مفترضة في الخطة. يمكن إكمال ledger والاختبارات sandbox قبل القرار.
- جداول/versioned catalog `packages`, `learner_subscriptions`, `entitlements`, `credit_ledger`, `payment_attempts`, `provider_events`, `refunds`؛ دفتر مالي immutable ذو قيد توازن/منع السالب، unique provider event/idempotency؛ عدم خصم حصة عند مجرد حجز تجريبي أو فتح صفحة.
- صاحب الحساب يدفع ويعرض رصيد كل طالب مستقلاً، موعد التجديد، فواتير، تاريخ الدفع، سبب الخصم، التعويض والإلغاء والتجميد والتغيير، أرصدة التعويض حسب السياسة المعتمدة؛ لا نقل رصيد أخ لأخ آخر دون عملية واضحة ومصرح بها.
- Webhook موقّع verified provider-side؛ pending/failure/refund/chargeback؛ retries وoutbox؛ لمرة واحدة لكل عملية؛ تسوية ledger والموعد، مع compensating credit on cancellation إن كانت مستحقة.
- **بعد هذا البوابة فقط**: book weekly recurring schedule, balance hold/consume/release, makeups, cancellation exceptions؛ D1 يرفض overlap والرصيد غير الكافي.
- **قبول:** webhook مكرر أو متأخر لا يضيف باقة مرتين؛ حجزان متزامنان لا يستهلكان نفس الرصيد؛ رفض دفع لا يظهر «نشط»؛ ردّ الدفع يصحح الاستحقاق بصورة مدققة.

## 8. مرحلة 05 — «الواجبات والتسميعات» ↔ «تدريباتي»

**الواجهات:** `/teacher/assignments` + `/student/training` tabs `واجباتي / الحفظ والمراجعة / الاستعداد للحصة`.

- teacher draft/publish per-learner task وربطه بخطة أكاديمية إن لزم **بدون تعديل الخطة تلقائيًا**. مطلوب: سورة/من آية إلى آية، طبعة/anchors موثقة، نوع حفظ/مراجعة/تلاوة، موعد/عدد تكرارات، رسالة، متطلبات صوت اختيارية؛ متعدد الطلاب يولّد assignment منفصلًا لكل learner، with immutable revision and assignee history.
- واجب منشور يظهر للطالب في `واجباتي`، فتح نفس صفحة `ReaderPrintedPage` محددة بالآيات المعتمدة، conceal/reveal practice؛ draft response autosave بوضوح، `جهزت للمراجعة` لا تعني `سلّمت`؛ إرسال صريح مع operationId. المواعيد/late status من server time.
- `الحفظ والمراجعة` الحرة تظل مستقلة، لا تصنع واجب شيخ/درجة، لكن يمكن حفظ progress الشخصي بطلب مستقل. `الاستعداد للحصة` يربط الواجبات/التقرير السابق/أقرب حجز حقيقي ولا يخترع موعدًا.
- نموذج حالات `draft → assigned → in_progress → submitted → under_review → completed | retry_requested | cancelled`، مع attempts مستقلة؛ عند تعديل واجب منشور يظهر revision مع السياسة، ولا تضيع محاولات سابقة.
- **قبول:** الشيخ ينشر لأحمد فقط → يظهر في تدريبات أحمد بعد Refresh، لا يظهر لأخيه، تُفتح الآيات الصحيحة، يمكن حفظ مسودة/إكمال وارسال صريح، الشيخ يرى نفس submission واحدة بلا تكرار أو تناقض.

## 9. مرحلة 06 — تسجيل التسميع وR2 وتصحيح الشيخ

**الواجهات:** `TrainingVoicePractice` (الآن MediaRecorder محلي)، `/teacher/assignments` review/playback.

- لا يبدأ microphone قبل موافقة صريحة، لا تشغيل خلفي، audio preview/cancel/delete، إتاحة إعادة التسجيل. التفريق بين تدريب شخصي لا يغادر الجهاز وتسليم صوت للشيخ يحتاج فعل موافقة/إرسال منفصلًا.
- private R2 `assignment-audio/<learnerId>/<assetId>` مع DB `audio_assets` والموافقة، quota/size/type/duration وchecksum؛ upload intent وبعده direct/resumable upload ثم finalize بتحقق من الحجم/النوع/hash؛ retries لا تكرر الملف/المحاولة، orphan cleanup؛ سياسة الاحتفاظ والحذف والتصدير.
- GET R2 audio موقّع قصير العمر أو Worker proxy بعد **recheck** أن الشيخ الأساسي الحالي أو البديل المصرح لهذا التكليف يجوز له سماعها. لا public `r2.dev` لمحتوى الطلاب. لا افتراض تفريغ صوت AI أو تلقائية تصحيح.
- الشيخ يستمع ويرد بملاحظات نصية/صوتية مرتبطة بآيات إذا أُتيح، يقبل أو يطلب إعادة؛ المحاولات immutable؛ تسليم جديد revision منفصل؛ إشعار الطالب يخرج من outbox لاحقًا.
- **قبول:** mic-denied، mobile recording، upload interrupted+retry، logout during upload، spoofed MIME/file، foreign user/private signed URL expiry، feedback duplicate، وملف مسموع بعد Refresh من حساب مخول فقط.

## 10. مرحلة 07 — «تقارير الحصص» ↔ «تقدمي وتقاريري»

**الواجهات:** `/teacher/reports`, `/student/progress`, آخر تقرير في Dashboard.

- `lesson_report_drafts`, `published_report_revisions`, `latest_published` أو نمط آمن مرجعي؛ التقرير مربوط **بحصة موجودة وصحيحة**، لا fictitious grade. إذا لم تكتمل حصة فعلية فحالة «بانتظار اكتمال الحصة»؛ اختباراتنا تستخدم حدثًا اصطناعيًا مصرحًا من contract الخاص بالـClassroom.
- حفظ مسودة غير مرئية للطالب، مع درجات **حفظ/تلاوة/تجويد 0..10 مستقلة وnullable**، النص والتصحيح والآيات والواجب المقترح، actor/update revision؛ منع lost update، دعم مراجعة/preview.
- نشر صريح transaction/immutable snapshot + pointer atomically. تحرير تقرير منشور ينشئ **مسودة تعديل**؛ النسخة السابقة تظل للطالب حتى اعتماد الجديدة؛ no edits in place؛ تاريخ مؤلف ومتى نُشر.
- الشيخ البديل: يرى/يصحح تقرير **الحصة التي درّسها فقط** في نافذة 24 ساعة من أول نشر وفق السياسة المعتمدة، ثم يُرفض؛ لا كشف التاريخ الكامل ولا العلامات الشخصية.
- الطالب يعرض **آخر نسخة منشورة فقط لكل حصة**، جدول زمني أحدث أولًا، expanded row، nullable يكتب «لم يُقيَّم» لا 0، لا score composite أو phantom archive link، وارتباط الطالب محفوظ.
- **قبول:** مسودة في الشيخ لا تظهر للطالب؛ r1 منشور، r2 draft موجود وr1 ظاهر، نشر r2 يحول pointer، شقيق أو معلم غير مخول لا يقرأ؛ 409 revision ومقارنة فعليين بعد refresh.

## 11. مرحلة 08 — «دفتر الحصص» والتقدم والملاحظات الشخصية

**الواجهات:** `/student/notebook`, روابط التقرير وتقدّم القراءة، `/teacher/preparation`.

- دفتر الحصص: كل completed lesson + آخر تقرير منشور + سياق الآيات/التكاليف، مع **نفس Quran Renderer**؛ لا إعادة تخزين النص أو صورة صفحة ثانية؛ ملاحظات الطالب الشخصية تحفظ في `learner_notebook_notes` مستقلة عن report/teacher marks، قابلة للبحث/التحرير/الحذف/استعادة النسخ حسب السياسة.
- إن توفر **sealed snapshot from Classroom** لاحقًا: طبقة علامات الشيخ المعتمدة read-only، personal overlay منفصل، إذن مشاركة محدود، anchor/version/manifest audit؛ snapshot missing => «الأرشيف قيد التجهيز» ولا زر PDF فارغ أو صورة وهمية.
- APIs لإنشاء/قراءة note/report/lesson-context موجودة وتُختبر بملفات snapshots صناعية سليمة المصدر؛ PDF/PNG from authorized immutable snapshot R2 private and signed short-lived access عند توفره؛ عدم استخدام markers من private mushaf في أرشيف الحصة تلقائيًا.
- الطالب يرى التقدم فقط من درجات وتقارير ومحاولات معتمدة، لا يعتبر «تدربت» = «حفظت رسميًا». تجميع scoped لكل learner، pagination.
- **قبول:** ملاحظة في دفتر أحمد تظهر بعد Refresh ولا تُعرض لأخيه/الشيخ؛ تحرير التقرير لا يغير النسخة المعتمدة القديمة؛ أرشيف missing يعرض انتظارًا صادقًا؛ تبديل قارئ عربي/موبايل لا يكشف العلامات الخاصة.

## 12. مرحلة 09 — الحضور، الغياب، الاعتراضات وحالات الشيخ

**الواجهات:** `/student/progress` attendance subpage، `/teacher/cases`, `/teacher/schedule`, رابط دعم الموعد.

- سجلات حضور authoritative `attendance_events`/ `incidents` من actor verified أو **عقد Classroom لحضور مؤكد**؛ لا نستنتج غيابًا من تبويب مقفول أو WebSocket dropout. الحالات pending/under-review/accepted/rejected/resolved + audited admin decision.
- سياسة معتمدة: انتظار الطالب المتأخر **15 دقيقة** ثم بلاغ غياب مؤقت **بلا خصم تلقائي**؛ الشيخ المتأخر تنبيه إدارة عند +5 دقائق وتصعيد +10؛ الطالب قد يخرج بطلب مراجعة بلا اتهام غياب؛ انقطاع الشبكة لا يعني انتهاء الحصة. أي تعويض/تغيير رصيد يمر ledger وموافقة الإدارة.
- ولي الأمر/الطالب يقدّم اعتراضًا خلال **7 أيام** (حسب السياسة المذكورة في roadmap وتحتاج تثبيت) مع سبب ومستند خاص R2 ومراجعة/سحب/نتيجة وإشعار؛ duplicate request لا يكرر case؛ حساب خاطئ لا يطلع على تفاصيل.
- تعيين شيخ بديل وموافقة ولي الأمر/المتعلم قبل إعطاء access مؤقت؛ سحب access عند انتهاء الحصة طبقًا لعقد Classroom، والتقرير له نطاق استثناء 24h فقط.
- **قبول:** غياب مبدئي لا يخصم، التصعيد ينشئ case واحدة، اعتراض بحساب آخر 404، admin decision موثق، no-show بعد حضور متأخر يُصحح ولا يمحو التاريخ، إخفاق مزوّد لا ينتج حكمًا كاذبًا.

## 13. مرحلة 10 — الإشعارات وWhatsApp

**الواجهات:** `/teacher/notifications`, إشعارات الطالب داخل حسابه (تُدمج في shell/navigation القائمة دون إنشاء Dashboard ولي أمر جديدة)، الروابط.

- `notices`, `notification_receipts`, `channel_consents`, `notification_outbox`; ترتيب مرتبط بالمتلقي والطالب/الحصة/الواجب/التقرير مع `read` idempotent وحظر التسرب بين الإخوة.
- تذكير **داخل التطبيق** قبل الحصة بـ24 ساعة وبساعة حسب السياسة؛ WhatsApp **قبل الحصة بساعة فقط** لمن وثّق رقمًا ووافق على القناة واعتمد نموذج مزوّد رسمي؛ إلغاء/إعادة جدولة يُلغيان جدولة الرسائل القديمة؛ no grades/child details in WhatsApp.
- Queue/Cron + durable outbox dedupe `(lessonId,recipient,channel,reminderStage,revision)`, retry/backoff, send status/delivery/failed and opt-out. لا تكرار بعد إعادة deploy، ولا إرسال وهمي من Demo.
- **قبول:** opt-out = صفر واتساب، موعد ملغى = صفر reminder، تعدد الأطفال في حساب واحد لا يرسل مكررًا خاطئًا، جدولة Cairo DST، فشل المزوّد لا يغيّر الحجز أو يفقد notice داخلي.

## 14. مرحلة 11 — إقفال Landing / UX / Accessibility / SEO

**الواجهات:** `/` وكل الصفحات المذكورة، desktop/tablet/mobile.

- CTA التسجيل ينقل لمسار Better Auth الصحيح عند الاتصال؛ لوحة Demo الدعائية إن بقيت واضحة كـ«تجربة فقط» ولا تُنشئ حجزًا أو حالة مالية؛ بيانات البرامج/الأسعار/FAQ والسياسات دقيقة وليست وعدًا غير متاح.
- لا روابط ميتة: signup, login, profile switch, book, pay, task submit, report expand, audio consent, notification settings، support. برامج التحفيظ للطفل والبالغ مع هوية ولي الأمر، no separate parent dashboard.
- 360×667، 390×844، 768×1024، 1280×900، 1440×900؛ RTL keyboard/tab/focus trap/contrast/reduced motion, screen-reader labels; Android touch and physical stylus manual. في صفحات الطالب والشيخ لا تقطع أدوات العمل ولا تعيق الـsticky UI القراءة؛ المصحف يأخذ المساحة الممكنة.
- Text fidelity: لا «تم الحفظ/تم الدفع/تم إرسال الواجب» دون server ACK؛ صفحات التقارير/الملفات لا تظهر بيانات demo مع حساب logged-in. Empty/retry/pending/offline/access-denied واضحة ومترجمة.
- **قبول:** E2E لكل رابط وCTA، Chrome screenshots وa11y CI؛ صاحب الحساب ينجز المهمة الأساسية على الموبايل دون scroll غير ضروري أو أزرار معطلة مخفية.

## 15. مرحلة 12 — إغلاق الثغرات والتشغيل والأمان والنسخ

- Contract/unit/SQLite native D1 migrations/Worker auth/Cloudflare Dev R2 tests لكل stage، role matrix: anonymous, owner A, sibling A/B, owner B, active teacher A, teacher B, retired teacher, approved/revoked substitute, staff.
- Race/concurrency: double click assignment, dual edits plan, duplicate payment webhook, two slot bookings, retry note save, expired session, interrupted upload, missed Queue, wrong owner path, cache revalidation, timezone & DST.
- Data & ops: D1 Time Travel plus verified export/restore, R2 private backup/versioning/checksum/retention, Queue+outbox reconciliation, log scrub / requestId, alert & failure dashboards, deletion/export/consent revocation, cost/perf/load on realistic test counts; asset URL/auth and cache expiry verified. D1 alone isn't enough to restore R2.
- Feature freeze only after **all page rows below** accepted from the ordinary Dev URL, backed by CI run URLs, screenshots and state persistence. No production cutover without separate owner authorization, phone/PSP provider decisions and child-privacy acceptance.
- Classroom adapter handshake tests (mocked **and clearly labeled synthetic**) must cover `lesson_completed`, sealed archive reference and authenticated attendance evidence; after standalone Classroom is delivered its integration suite is rerun, **not silently marked passed** now.

## 16. مصفوفة قبول صفحة بصفحة (لا تُغلق بدون E2E)

| Route / area | Evidence required to close | Depends on |
|---|---|---|
| `/` / landing / signup | حقيقة CTA/registration+guardian consent, no mock booking; responsive + SEO | 01, 03, 11 |
| `/student` | real next lesson/plan/approved tasks/latest report, no fake counts | 02, 03, 05, 07 |
| `/student/lessons` | real trial/availability/weekly/booking/cancel/reschedule, per learner | 03–04 |
| `/student/mushaf` | real verified Quran+private D1 stroke/note/bookmark/position, Chrome pointer/mobile/refresh/device/retry/no sibling leak | 01, 12 |
| `/student/training` | three tabs, published task/draft/send/voice retry, no false grades | 05–06 |
| `/student/progress` | published report history, 3 nullable scores, actual attendance & appeal | 07, 09 |
| `/student/notebook` | per-lesson history + private notes + honest snapshot/pending/restricted exports | 07–08 + Classroom sealed archive input |
| `/student/subscription` | actual entitlements/ledger/payments/invoices/refunds and receipts | 04 |
| `/student/account` | Better Auth verified identity + <=8 profiles, edit/archive/recovery/consent | 01 |
| `/teacher` | qualified active teacher real roster/next slot/pending actions; no fixtures | 01–02 |
| `/teacher/students` | assigned roster, academic plan save/revision, access control | 02 |
| `/teacher/schedule` | teacher calendar + 40m slots, cancel/change, alerts, room handoff disabled until Classroom | 03–04, 09 |
| `/teacher/preparation` | assigned lesson brief + previous published report/tasks, versioned private prep; no fake presence | 02, 05, 07 |
| `/teacher/assignments` | publish/edit/withdraw, attempts/private audio/feedback/retry, authorisation | 05–06 |
| `/teacher/reports` | save draft/publish/replace version, substitute scope, same latest report student sees | 07 |
| `/teacher/notifications` | actual inbox/read, queue/reminders/consent | 10 |
| `/teacher/cases` | authenticated incident/appeal/adjudication + credit correction through ledger | 09 |
| Universal shells | menu/RTL/sidebar/mobile, loading/empty/offline/error/denied, no demo leakage | 00–12 |
| `/classroom` | **EXCLUDED**: handled separately; no claim of completion from this matrix | Separate program |

## 17. جدول التسليم العملي والاعتماد بين المراحل

```text
00 Inventory/Contracts
   └─ 01 Identity, guardian & teacher qualification
       ├─ 02 Teacher roster + plan + real Student home
       │   ├─ 03 Trial + availability + scheduling base
       │   │   └─ 04 Credit ledger/payment + recurring/makeup scheduling
       │   ├─ 05 Assignments published → Student "تدريباتي"
       │   │   └─ 06 Private R2 voice → Teacher feedback
       │   └─ 07 Reports draft/publish → Student progress
       │       └─ 08 Notebook + personal notes + archive-reader contract
       ├─ 09 Attendance/cases/appeals (requires actual events later)
       └─ 10 Notifications/WhatsApp (after booking + consent)
11 Landing/UX/a11y evolves with every slice
12 Cross-role E2E, real Dev deployment evidence, restore/load/security gates
CLASSROOM: separate external source of sealed lesson snapshot, presence and Start/End.
```

**يُسمح بالتوازي** بين فريق المخططات/الواجبات، وفريق الدفع، وفريق الإشعارات، ولكن بعد تثبيت عقود المرحلة 00 والهوية 01. لا ترفع تسجيلًا خاصًا قبل تجهيز R2/consent والـACL. لا تصدر تقريرًا من Classroom قبل وجود عقد `completed lesson` معتمد، ولا تمنع إقفال APIs التقارير/دفتر الحصص باختبار completed-lesson fixture معتمد صناعيًا.

## 18. بروتوكول التنفيذ لكل Slice (غير قابل للاختصار)

1. GitHub issue بعقد وإجراءات قبول وملفات ومسارات بعينها؛ تحديث هذا الجدول وتحديد `not done/done` بدل عناوين مبهمة.
2. Focused PR لواجهة + Worker API + D1 migration/R2 config + shared schema + unit/auth/rollback، وليس واجهة تجريبية منفصلة فقط.
3. Exact-head GitHub Verify **أخضر** + code review + SQL migration lineage + demo-isolation and permission negative tests، merge only then.
4. نشر **نفس** Noor development Worker المفتوح بواسطة Santoreno Cloudflare secrets/Actions؛ **لا duplicate password-gated QA Worker**، لا بيانات بشرية حقيقية أو تغيير production.
5. اختبارات دورين/شقيقين بالموقع عن طريق browser + remote API، تليها Refresh/new browser, failed request and evidence screenshot. اختبار Android physical S Pen يدويًا صراحة.
6. تعليق إغلاق: PR وmerge SHA وrun URLs، قائمة ما شُغّل فعلًا، سياسة الخصوصية، ماذا يبقى وعقد Classroom handoff. إذا فشل التشغيل لا يُغلق الـIssue ولو نجح Build.
7. مراجعة acceptance matrix لكل route بعد أي تغيير في قاعدة المستخدم أو schema، وتشغيل regression عبر الطالب+الشيخ قبل التسمية **«جميع الواجهات غير الفصل مكتملة»**.

## 19. قرارات مالك يجب حسمها دون تعطيل العمل المستقل

- مزوّد تحقق الهاتف/الرسائل وتكلفته وسياسة موافقات القاصرين والاحتفاظ؛ لا إتاحة أطفال حقيقيين قبلها.
- أسعار/أطوال باقات الدروس واستحقاقات الحصص، ضريبة/فواتير/استرداد، واختيار PSP وسياسة النزاعات؛ ledger/schema يمكن تنفيذهما قبل التعاقد.
- مزوّد WhatsApp المعتمد وقوالب الرسائل والاشتراك المسبق؛ in-app notices/queue مستقلان.
- سياسة ملفات صوت الطلبة: سقف الحجم/المدة، الاحتفاظ، ما الذي يُحذف عند الإلغاء، ومن يحق له سماعه.
- تواريخ المهلة لإعادة التسميع والاعتراض وتصحيح تقرير البديل وفق السياسات المعتمدة؛ لا نخترع تمديدًا/خصمًا/استثناء ماليًا.
- شكل إصدار أرشيف دفتر الحصص/PDF بعد استلام Classroom sealed snapshot؛ بناء viewer/schema/permissions يمكن اكتماله قبل الـClassroom.

**معنى «خلصنا كل الواجهات»**: صفحات الطالب والشيخ والهبوط والحساب تستعمل API حقيقي أو حالة انتظار صريحة تعتمد فقط على مصدر Classroom المستثنى؛ كل Workflow غير حي خارج Classroom مكتمل ومختبر على Dev، ولا يوجد زر Demo يُقدَّم على أنه عملية فعلية، ولا يوجد فقد/تسريب بيانات معروف، وقائمة أدلة قابلة للمراجعة — لا مجرد 100% واجهات مرسومة.
