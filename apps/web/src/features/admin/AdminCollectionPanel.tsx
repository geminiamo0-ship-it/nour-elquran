'use client';
import {useEffect,useMemo,useState} from 'react';
import type {AccountSession} from '@/features/account';
import {fetchAdminCollection,AdminCollectionError,
 type AdminCollection,type AdminDataView,type AdminDataRow} from './admin-collections-client';
import css from './AdminPortal.module.css';

type Read=
 |{phase:'idle'}
 |{phase:'loading'|'error'|'denied';session:AccountSession;view:AdminDataView}
 |{phase:'ready';session:AccountSession;view:AdminDataView;data:AdminCollection};
type Field=Readonly<{key:string;label:string}>;
type Config=Readonly<{title:string;intro:string;scope:string;fields:readonly Field[]}>;
const configurations:Record<AdminDataView,Config>={
 students:{
  title:'الطلاب والأسر',
  intro:'ملفات الطلاب المستقلة داخل الحسابات النشطة. تعرض أسماء الملفات التعليمية فقط دون أرقام تواصل أو بيانات ولي الأمر.',
  scope:'السجل لأغراض المتابعة فقط. تغيير الأسرة أو أرشفة الطالب أو تعيين الشيخ يحتاج إجراءً إداريًا منفصلًا.',
  fields:[{key:'name',label:'الطالب'},{key:'learnerType',label:'نوع الملف'},
   {key:'status',label:'حالة الملف'},{key:'lessonCount',label:'كل الحصص المسجلة'}],
 },
 schedule:{
  title:'الحصص والجدول',
  intro:'الحصص الموجودة فعليًا من آخر سبعة أيام وحتى الثلاثين يومًا القادمة؛ لا يُنشئ العرض حجوزات جديدة.',
  scope:'تبدأ الحصة وتنتهي من أحداثها المعتمدة فقط، ولا يوجد خصم أو إلغاء أو تعويض من هذه الواجهة.',
  fields:[{key:'startsAtMs',label:'الموعد'},{key:'learnerName',label:'الطالب'},
   {key:'teacherName',label:'الشيخ'},{key:'kind',label:'نوع الحصة'},
   {key:'status',label:'الحالة'}],
 },
 subscriptions:{
  title:'دورات الاشتراكات',
  intro:'دورات الرصيد الأكاديمي المسجلة في سجل D1؛ الوحدة هي حصة تعليمية وليست جنيهًا أو تأكيدًا للدفع.',
  scope:'الأرقام من سجل الدورات والصرف فقط. لا توجد هنا مبيعات أو تفعيل دفع أو تجديد أو تسوية.',
  fields:[{key:'learnerName',label:'الطالب'},{key:'startsAtMs',label:'بداية الدورة'},
   {key:'endsAtMs',label:'نهاية الدورة'},{key:'baseSessions',label:'الحصص الأساسية'},
   {key:'rolloverSessions',label:'المرحّل'},{key:'spentSessions',label:'المستخدم'}],
 },
 attendance:{
  title:'الحضور والتعويضات',
  intro:'طلبات الاعتراض المسجلة على بلاغات الحضور. لا تُعرض الملاحظات الحساسة أو تفاصيل الشكوى في القائمة.',
  scope:'حالة الاعتراض ليست حكمًا بخصم حصة أو استحقاق تعويض. القرارات والتعويضات تحتاج مراجعة منفصلة.',
  fields:[{key:'submittedAtMs',label:'تاريخ الاعتراض'},
   {key:'kind',label:'نوع البلاغ'},{key:'decision',label:'قرار المراجعة'}],
 },
};
const dictionary:Record<string,string>={
 adult:'بالغ',child:'طفل',active:'نشط',archived:'مؤرشف',
 trial:'تجريبية',standard:'عادية',makeup:'تعويض',
 scheduled:'مجدولة',live:'جارية',completed:'مكتملة',cancelled:'ملغاة',
 student_no_show:'بلاغ عدم حضور طالب',
 connection_interruption:'انقطاع الاتصال',
 pending:'بانتظار المراجعة',accepted:'مقبول',rejected:'مرفوض',
};
const dates=new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',
 timeZone:'Africa/Cairo'});
function show(key:string,value:string|number){
 if(['startsAtMs','endsAtMs','submittedAtMs'].includes(key)&&typeof value==='number')
  return dates.format(new Date(value));
 if(typeof value==='number')return value.toLocaleString('ar-EG');
 return dictionary[value]??value;
}
function matching(row:AdminDataRow,term:string){
 return Object.values(row).some(value=>String(value).toLocaleLowerCase().includes(term));
}

/** A hidden or changing session must never display a previously fetched list. */
export function AdminCollectionPanel({view,session}:{view:AdminDataView;session:AccountSession}){
 const [read,setRead]=useState<Read>({phase:'idle'});
 const [retry,setRetry]=useState(0);
 const [query,setQuery]=useState('');
 useEffect(()=>{
  const ctrl=new AbortController();
  setQuery('');
  setRead({phase:'loading',session,view});
  void fetchAdminCollection(view,ctrl.signal).then(data=>{
   if(!ctrl.signal.aborted)setRead({phase:'ready',session,view,data});
  }).catch(error=>{
   if(ctrl.signal.aborted)return;
   setRead({phase:error instanceof AdminCollectionError&&
    [401,403,404].includes(error.status)?'denied':'error',session,view});
  });
  return ()=>ctrl.abort();
 },[view,session,retry]);
 const visible=read.phase==='ready'&&read.session===session&&read.view===view?read.data:null;
 const status=read.phase==='idle'||!('session' in read)||read.session!==session||
  read.view!==view?'loading':read.phase;
 const term=query.trim().toLocaleLowerCase();
 const rows=useMemo(()=>visible?.rows.filter(row=>!term||matching(row,term))??[],
  [visible,term]);
 const config=configurations[view];
 return <section className={css.collection} aria-labelledby="admin-collection-heading">
  <header className={css.collectionHero}>
   <p className={css.kicker}>إدارة الأكاديمية · سجل موثق</p>
   <h1 id="admin-collection-heading">{config.title}</h1>
   <p>{config.intro}</p>
  </header>
  <div className={css.collectionToolbar}>
   <label className={css.collectionSearch}>
    <span>بحث في السجلات المعروضة</span>
    <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
     disabled={!visible} placeholder="ابحث داخل أول ٥٠ سجلًا فقط" />
   </label>
   <button type="button" className={css.staffRefresh}
    disabled={status==='loading'} onClick={()=>setRetry(n=>n+1)}>تحديث البيانات</button>
  </div>
  {status==='loading'&&<p className={css.staffEmpty} role="status">
   جارٍ التحقق من صلاحيات الإدارة وتحميل السجل…</p>}
  {status==='denied'&&<p className={css.staffError} role="alert">
   ليس لهذا الحساب صلاحية الاطلاع على السجل الحالي. لن نعرض أي بيانات سابقة.</p>}
  {status==='error'&&<div className={css.staffError} role="alert">
   <p>السجل غير متاح حاليًا. لن نعرض أرقامًا صفرية أو بيانات تجريبية بدلًا منه.</p>
   <button type="button" onClick={()=>setRetry(n=>n+1)}>إعادة المحاولة</button>
  </div>}
  {visible&&<>
   <p className={css.staffInfo} role="status">
    آخر قراءة: {dates.format(new Date(visible.asOfMs))} ·
    {visible.truncated?' القائمة محدودة بأول ٥٠ سجلًا، توجد سجلات أخرى.':
     ' كل السجلات المتاحة ضمن حدود هذه القائمة.'}
    {term?' · البحث داخل النتائج المحمّلة فقط.':''}
   </p>
   {rows.length===0?<div className={css.staffEmpty} role="status">
    {visible.rows.length===0?'لا توجد سجلات مسجلة ضمن نطاق هذا القسم.':
     'لا توجد نتائج مطابقة للبحث داخل السجلات المعروضة.'}
   </div>:<div className={css.collectionCards} role="list"
      aria-label={config.title}>{rows.map(row=>
     <article className={css.collectionCard} role="listitem" key={row.id}>
      {config.fields.map(field=><div className={css.collectionField} key={field.key}>
       <span>{field.label}</span>
       <strong>{show(field.key,row[field.key]!)}</strong>
      </div>)}
     </article>)}</div>}
  </>}
  <p className={css.collectionDisclaimer}>{config.scope}</p>
 </section>;
}
