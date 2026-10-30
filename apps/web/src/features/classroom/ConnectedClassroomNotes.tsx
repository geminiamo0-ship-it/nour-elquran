'use client';
import {useState} from 'react';
import type {QuranTarget} from '@/features/student';
import css from './Classroom.module.css';
import extra from './ConnectedClassroom.module.css';

type Tab='corrections'|'notes'|'draft';
/** Original lesson side-panel shell, but no simulated writes or invented report state. */
export function ConnectedClassroomNotes({role,page,selectedVerse}:{
 role:'teacher'|'student';page:number;selectedVerse:QuranTarget|null;
}){
 const [tab,setTab]=useState<Tab>('corrections');
 if(role==='student')return <aside className={css.notesPanel}>
  <div className={css.panelHeading}><strong>مساحة الطالب</strong></div>
  <p className={css.hint}>تظهر هنا العلامات والتصحيحات المعتمدة بعد ربط التزامن الموثق.</p>
  <div className={css.selectedAyah}><span>الصفحة المحلية</span><strong>{page} / 604</strong></div>
  <p className={css.warn}>لا تُنشر أي علامة أو ملاحظة من هذا العرض.</p>
 </aside>;
 return <aside className={css.notesPanel} aria-label="لوحة تصحيحات الشيخ الخاصة">
  <div className={css.panelHeading}><strong>ملف الحصة</strong><span>خاص بالشيخ</span></div>
  <nav className={css.tabs} role="tablist" aria-label="لوحة الشيخ">
   {([{id:'corrections',label:'الأخطاء'},{id:'notes',label:'الملاحظات'},
    {id:'draft',label:'التقييم'}] as const).map(item=>
    <button key={item.id} type="button" role="tab" aria-selected={tab===item.id}
     onClick={()=>setTab(item.id)}>{item.label}</button>)}
  </nav>
  <div className={css.tabBody}>
   <p className={css.warn}>هذه الأدوات غير مفعّلة في الحصة المتصلة حتى ربط حفظ البيانات والصلاحيات؛ لن نسجل شيئًا وهميًا.</p>
   {tab==='corrections'&&<>
    <p className={css.hint}>يمكنك تحديد الآية على المصحف للرجوع إليها محليًا فقط.</p>
    <div className={css.selectedAyah}><span>الآية المختارة</span>
     <strong>{selectedVerse?selectedVerse.surah+':'+selectedVerse.ayah:'اختر آية أولًا'}</strong></div>
    <label className={css.field}>نوع الخطأ<select disabled><option>الحفظ</option></select></label>
    <label className={css.field}>ملاحظة قصيرة<textarea disabled rows={3} placeholder="تُفعّل عند ربط دفتر الحصص"/></label>
    <button type="button" className={css.primaryBtn} disabled>تسجيل التصحيح</button>
   </>}
   {tab==='notes'&&<label className={css.field}>ملاحظات الشيخ الخاصة
    <textarea rows={7} disabled placeholder="ستُحفظ في دفتر الحصص بعد تفعيل التكامل"/>
   </label>}
   {tab==='draft'&&<>
    {['الحفظ','التلاوة','التجويد'].map(title=><label className={css.field} key={title}>
     {title}<select disabled><option>لم يُقيّم</option></select>
    </label>)}
    <p className={css.hint}>النشر يتطلب حفظ تقرير حقيقي مرتبط بالحصة، وليس مسودة محلية مزعومة.</p>
   </>}
  </div>
  <div className={extra.notesFooter}>لا توجد بيانات حصة مصطنعة أو عمليات حفظ تلقائية.</div>
 </aside>;
}
