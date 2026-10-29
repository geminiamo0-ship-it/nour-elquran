'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useTeacher} from './TeacherContext';
import {Empty,Panel,Pill,SectionHeading} from './TeacherUI';
import styles from './TeacherPortal.module.css';
export function TeacherNotifications(){
  const {notices,markNotice}=useTeacher();
  const [filter,setFilter]=useState<'all'|'unread'>('all');
  const shown=notices.filter(n=>filter==='all'||!n.read);
  return <div>
    <SectionHeading eyebrow="تنبيهات موجهة للعمل" title="مركز الإشعارات"
      description="أخبار الحصص والتعديلات والتسميعات والتقارير، دون نشر درجات أو أخطاء الطالب عبر الرسائل الخارجية."/>
    <div className={styles.infoBar}>التذكير قبل الحصة بـ٢٤ ساعة وبساعة؛ إشعار WhatsApp قبلها بساعة فقط بعد موافقة صاحب الرقم واعتماد قالب الرسالة. لا توجد رسائل حقيقية من هذه المعاينة.</div>
    <Panel title="تنبيهات الشيخ" extra={<Pill tone="warning">{notices.filter(n=>!n.read).length} غير مقروء</Pill>}>
      <div className={styles.filterBar}><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>الكل</button><button type="button" aria-pressed={filter==='unread'} onClick={()=>setFilter('unread')}>غير المقروء</button></div>
      {shown.length?shown.map(n=><article key={n.id} className={styles.notificationItem}>
        <span className={n.read?styles.readDot:styles.unreadDot} aria-hidden="true"/>
        <div><strong>{n.text}</strong><p>{n.detail}</p></div>
        <div className={styles.actions}><Link href={'/teacher/'+n.section} className={styles.textLink}>فتح القسم</Link>
          {!n.read&&<button type="button" className={styles.secondaryButton} onClick={()=>markNotice(n.id)}>تعليم كمقروء</button>}</div>
      </article>):<Empty title="لا توجد إشعارات بهذا التصنيف" description="لن ننشئ إشعارات أو مواعيد افتراضية لشيوخ ليس لديهم بيانات مسندة."/>}
    </Panel>
    <Panel title="قواعد التذكير"><div className={styles.detailList}>
      <p>تغيير موعد الحصة يلغي التذكيرات القديمة ويعيد جدولتها على الموعد المؤكد الجديد.</p>
      <p>يُربط كل إرسال بمعرّف الحصة والقناة والمتلقي ومرحلة التذكير لتجنب التكرار.</p>
      <p>الرسالة الخارجية تحتوي الموعد ورابطًا آمنًا فقط، دون تقارير أو صوت أو ملاحظات خاصة.</p>
    </div></Panel>
  </div>;
}
