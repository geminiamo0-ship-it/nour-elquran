export type AttendanceStatus = 'attended' | 'absent' | 'cancelled' | 'rescheduled' | 'pending';
export type AppealStatus = 'under_review' | 'accepted' | 'rejected';
export type AttendanceRecord = Readonly<{
  id: string; learnerId: string; lessonId: string; lessonTitle: string;
  lessonAt: string; recordedAt: string | null; updatedAt: string;
  status: AttendanceStatus; reason: string | null; appealStatus: AppealStatus | null;
}>;

export const APPEAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_APPEAL_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_EVIDENCE_TYPES = ['image/jpeg','image/png','application/pdf'] as const;

/** UTC timestamps supplied by an authorized teacher/admin service, not a LiveKit join event. */
export function appealDeadline(record: AttendanceRecord): number | null {
  if (record.status !== 'absent' || !record.recordedAt) return null;
  const recordedAt = Date.parse(record.recordedAt);
  return Number.isFinite(recordedAt) ? recordedAt + APPEAL_WINDOW_MS : null;
}
export function canOpenAppeal(record: AttendanceRecord, now: Date): boolean {
  const deadline = appealDeadline(record);
  if (deadline === null || record.appealStatus !== null) return false;
  const startedAt = Date.parse(record.recordedAt!);
  return now.getTime() >= startedAt && now.getTime() <= deadline;
}

export function validateEvidence(file: Pick<File, 'type' | 'size'> | null): string | null {
  if (!file) return null;
  if (!ACCEPTED_EVIDENCE_TYPES.some((type) => type === file.type)) return 'نوع المرفق غير مدعوم: استخدم PDF أو JPG أو PNG.';
  if (file.size <= 0 || file.size > MAX_APPEAL_FILE_BYTES) return 'حجم المرفق يجب أن يكون أكبر من صفر ولا يتجاوز 5 ميجابايت.';
  return null;
}

/** Only one current authoritative attendance outcome per lesson; never count a rebooking twice. */
export function currentAttendance(records: readonly AttendanceRecord[], learnerId: string): AttendanceRecord[] {
  const byLesson = new Map<string, AttendanceRecord>();
  for (const record of records) {
    if (record.learnerId !== learnerId || !record.lessonId) continue;
    const previous = byLesson.get(record.lessonId);
    if (!previous || record.updatedAt > previous.updatedAt ||
       (record.updatedAt === previous.updatedAt && record.id > previous.id)) byLesson.set(record.lessonId,record);
  }
  return [...byLesson.values()].sort((a,b)=> b.lessonAt.localeCompare(a.lessonAt) || a.id.localeCompare(b.id));
}
export function attendanceCounts(records: readonly AttendanceRecord[]) {
  return {
    attended: records.filter((x)=>x.status === 'attended').length,
    absent: records.filter((x)=>x.status === 'absent').length,
    cancelled: records.filter((x)=>x.status === 'cancelled').length,
    rescheduled: records.filter((x)=>x.status === 'rescheduled').length,
    pending: records.filter((x)=>x.status === 'pending').length,
  };
}
function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86400000).toISOString();
}
/** Fictional examples only, with relative dates for testing the 7-day window across calendar days. */
export function getDemoAttendance(learnerId: string, now = new Date()): AttendanceRecord[] {
  if (learnerId !== 'demo-active') return [];
  const fixtures: AttendanceRecord[] = [
    { id:'a-1',learnerId,lessonId:'l-active-3',lessonTitle:'مراجعة سورة الإخلاص',
      lessonAt:daysAgo(now,2), recordedAt:daysAgo(now,2),updatedAt:daysAgo(now,2),
      status:'attended',reason:null,appealStatus:null },
    { id:'a-2',learnerId,lessonId:'attendance-demo-2',lessonTitle:'درس مراجعة (مثال)',
      lessonAt:daysAgo(now,4),recordedAt:daysAgo(now,3),updatedAt:daysAgo(now,3),
      status:'absent',reason:'حالة توضيحية لتقديم اعتراض خلال 7 أيام',appealStatus:null },
    { id:'a-3',learnerId,lessonId:'attendance-demo-3',lessonTitle:'تأجيل الحصة (مثال)',
      lessonAt:daysAgo(now,6),recordedAt:daysAgo(now,6),updatedAt:daysAgo(now,6),
      status:'rescheduled',reason:'أعيد تحديد الموعد',appealStatus:null },
    { id:'a-4',learnerId,lessonId:'attendance-demo-4',lessonTitle:'إلغاء من الأكاديمية (مثال)',
      lessonAt:daysAgo(now,9),recordedAt:daysAgo(now,9),updatedAt:daysAgo(now,9),
      status:'cancelled',reason:'لم تُحتسب غيابًا على الطالب',appealStatus:null },
    { id:'a-5',learnerId,lessonId:'attendance-demo-5',lessonTitle:'غياب سابق (مثال)',
      lessonAt:daysAgo(now,15),recordedAt:daysAgo(now,12),updatedAt:daysAgo(now,12),
      status:'absent',reason:'انتهت مهلة الاعتراض العادية',appealStatus:null },
    { id:'a-6',learnerId,lessonId:'attendance-demo-6',lessonTitle:'حصة قيد التحقق (مثال)',
      lessonAt:daysAgo(now,1),recordedAt:null,updatedAt:daysAgo(now,1),
      status:'pending',reason:'لم يسجل المعلم النتيجة النهائية',appealStatus:null },
  ];
  return currentAttendance(fixtures,learnerId);
}
