'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useStudent } from '../StudentContext';
import {
  appealDeadline, attendanceCounts, canOpenAppeal,
  getDemoAttendance, validateEvidence, type AttendanceRecord,
} from '../attendance';
import styles from '../StudentPortal.module.css';
import css from './AttendanceWorkspace.module.css';

const statuses = {
  attended:'حضر',absent:'غاب',cancelled:'أُلغيت',
  rescheduled:'أُعيدت جدولتها',pending:'قيد مراجعة الحضور',
} as const;
const dateFormatter = new Intl.DateTimeFormat('ar-EG', {
  timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short',
});
function formatDate(iso:string):string { return dateFormatter.format(new Date(iso)); }

export function AttendanceWorkspace() {
  const { selected }=useStudent();
  const [now] = useState(() => new Date());
  const [selectedAppeal,setSelectedAppeal] = useState<string | null>(null);
  const [reason,setReason] = useState('');
  const [file,setFile] = useState<File | null>(null);
  const [fileError,setFileError] = useState<string | null>(null);
  const [preview,setPreview] = useState<{lessonId:string;reason:string;fileName:string|null}|null>(null);
  const records=useMemo(()=>getDemoAttendance(selected.profile.id,now),[selected.profile.id,now]);
  const counts=attendanceCounts(records);
  const selectedRecord=records.find((r)=>r.id === selectedAppeal) ?? null;

  function chooseRecord(record:AttendanceRecord) {
    setSelectedAppeal(record.id);setReason('');setFile(null);setFileError(null);setPreview(null);
  }
  function previewAppeal(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecord || !canOpenAppeal(selectedRecord,now)) return;
    const trimmed=reason.trim();
    if (trimmed.length < 10 || trimmed.length > 1000 || fileError) return;
    setPreview({lessonId:selectedRecord.lessonId,reason:trimmed,fileName:file?.name ?? null});
  }
  return <section className={styles.panel} aria-labelledby="attendance-heading">
    <div className={styles.panelHead}><div>
      <p className={styles.eyebrow}>سجل منفصل عن التقييمات الأكاديمية</p>
      <h2 id="attendance-heading">سجل الحضور والغياب</h2>
    </div><span className={styles.statusNeutral}>معاينة حالات وليست سجلات حقيقية</span></div>
    {records.length === 0 ? <div className={styles.emptyBox}>
      لا توجد سجلات حضور موثّقة لهذا الطالب. لن نعرض أرقام غياب أو حصصًا مختلقة.
    </div> : <>
      <p className={styles.panelIntro}>الأرقام التالية لبيانات مثال فقط، ولا يُحسب موعد ملغى أو مُعاد جدولته ضمن الغياب.</p>
      <div className={css.counts} aria-label="ملخص الحضور">
        {([
          ['attended','حضر'],['absent','غاب'],['cancelled','أُلغيت'],['rescheduled','أُعيدت جدولتها'],
        ] as const).map(([key,label])=><div className={css.count} key={key}>
          <span>{label}</span><strong>{counts[key]}</strong><small>حالات تجريبية</small>
        </div>)}
      </div>
      <div className={css.scroll} role="region" tabIndex={0} aria-label="جدول سجل الحضور والغياب">
        <table className={css.table}>
          <thead><tr><th scope="col">الحصة والتاريخ</th><th scope="col">النتيجة</th>
            <th scope="col">التوضيح</th><th scope="col">المراجعة</th></tr></thead>
          <tbody>{records.map((record)=><tr key={record.id}>
            <th scope="row"><strong>{record.lessonTitle}</strong><small>{formatDate(record.lessonAt)}</small></th>
            <td><span className={css.outcome}>{statuses[record.status]}</span></td>
            <td>{record.reason ?? 'لا توجد ملاحظات إضافية'}</td>
            <td>{record.status === 'absent' ? (record.appealStatus ?
              <span>الحالة: {record.appealStatus === 'under_review'?'قيد مراجعة الإدارة':record.appealStatus==='accepted'?'تم التصحيح':'رُفض الاعتراض'}</span> :
              canOpenAppeal(record,now) ? <button type="button" className={css.appealButton}
                onClick={()=>chooseRecord(record)} aria-expanded={selectedAppeal === record.id}>
                طلب مراجعة الغياب
              </button> : <span className={css.muted}>انتهت مهلة 7 أيام. تواصل مع الإدارة لطلب استثناء.</span>)
              : <span className={css.muted}>{record.status==='pending'?'بانتظار اعتماد النتيجة':'لا يلزم اعتراض'}</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {selectedRecord && canOpenAppeal(selectedRecord,now) && <section className={css.appealPanel} aria-labelledby="appeal-heading">
        <div className={styles.panelHead}><div><p className={styles.eyebrow}>معاينة طلب فقط</p>
          <h3 id="appeal-heading">طلب مراجعة الغياب</h3></div>
          <button type="button" className={styles.filterButton} onClick={()=>setSelectedAppeal(null)}>إغلاق</button>
        </div>
        <p><strong>الحصة:</strong> {selectedRecord.lessonTitle}، {formatDate(selectedRecord.lessonAt)}</p>
        <p><strong>مهلة الاعتراض حتى:</strong> {formatDate(new Date(appealDeadline(selectedRecord)!).toISOString())}</p>
        <form onSubmit={previewAppeal}>
          <label htmlFor="attendance-appeal-reason" className={styles.formLabel}>سبب الاعتراض (إلزامي، 10–1000 حرف)</label>
          <textarea id="attendance-appeal-reason" className={styles.textArea} minLength={10} maxLength={1000}
            required value={reason} onChange={(event)=>{setReason(event.target.value);setPreview(null);}}
            placeholder="اكتب ما حدث في الحصة، وسيُراجع من الإدارة عند تفعيل الخدمة" />
          <label htmlFor="attendance-evidence" className={styles.formLabel}>مرفق اختياري — JPG أو PNG أو PDF، بحد أقصى 5MB</label>
          <input type="file" id="attendance-evidence" className={css.fileInput}
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(event)=>{
              const picked=event.target.files?.[0] ?? null;
              setFileError(validateEvidence(picked));setFile(picked);setPreview(null);
            }} />
          {fileError && <p role="alert" className={styles.formError}>{fileError}</p>}
          <div className={styles.actionRow}><p className={styles.muted}>لن يُرفع الملف أو يُرسل الطلب في المعاينة.</p>
            <button type="submit" className={styles.actionButton} disabled={reason.trim().length < 10 || !!fileError}>
              معاينة الاعتراض
            </button></div>
        </form>
        {preview?.lessonId === selectedRecord.lessonId && <div role="status" className={styles.infoNote}>
          <strong>المراجعة قبل الإرسال:</strong> {preview.reason}
          {preview.fileName && <p>المرفق المختار: {preview.fileName}</p>}
          <p>هذه معاينة محلية فقط، لم يتم إنشاء أو إرسال طلب إلى الأكاديمية. سيظهر زر الإرسال بعد ربط الخدمة الرسمية.</p>
          <button type="button" className={styles.filterButton} disabled aria-label="إرسال الطلب غير متاح قبل ربط الخدمة">الإرسال غير متاح حاليًا</button>
        </div>}
      </section>}
      <p className={styles.panelFoot}>المعلم يسجل الحضور، والإدارة تراجع الاعتراضات. لا نستنتج الغياب من انقطاع الإنترنت أو الدخول للفصل، ولا نخصم حصصًا تلقائيًا.</p>
    </>}
  </section>;
}
