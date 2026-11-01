'use client';
import {useCallback,useEffect,useState} from 'react';
import type {QuranTarget} from '@/features/student';
import css from './Classroom.module.css';
import extra from './ConnectedClassroom.module.css';

type Tab='corrections'|'notes'|'draft';
type Kind='memorization'|'recitation'|'tajweed'|'pronunciation'|'general';
type Item={id:string;operationId:string;page:number;surah:number|null;ayah:number|null;
 kind:Kind;text:string;atMs:number};
type View={revision:number;items:Item[]};
type Props={role:'teacher'|'student';page:number;lessonId:string;
 joined:boolean;selectedVerse:QuranTarget|null;refreshVersion?:number};
const categories:ReadonlyArray<{value:Kind;label:string}>=[
 {value:'memorization',label:'الحفظ'},
 {value:'recitation',label:'التلاوة'},
 {value:'tajweed',label:'التجويد'},
 {value:'pronunciation',label:'النطق'},
];
const allTypes=[...categories,{value:'general' as const,label:'ملاحظة عامة'}];
function parse(raw:unknown):View{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID_CORRECTIONS');
 const v=(raw as Record<string,unknown>).corrections;
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('INVALID_CORRECTIONS');
 const s=v as Record<string,unknown>;
 if(!Number.isSafeInteger(s.revision)||Number(s.revision)<0||!Array.isArray(s.items)||
  s.items.length>120||!s.items.every(item=>item&&typeof item==='object'&&
    !Array.isArray(item)&&typeof (item as Item).id==='string'&&
    typeof (item as Item).text==='string'&&(item as Item).text.length<=500))
  throw Error('INVALID_CORRECTIONS');
 return v as View;
}
export function ConnectedClassroomNotes({role,page,lessonId,joined,selectedVerse,refreshVersion}:Props){
 const [tab,setTab]=useState<Tab>('corrections');
 const [kind,setKind]=useState<Kind>('memorization');
 const [text,setText]=useState('');
 const [view,setView]=useState<View|null>(null);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const url='/v1/teacher/lessons/'+encodeURIComponent(lessonId)+'/corrections';
 useEffect(()=>{
  if(role!=='teacher'||!joined){setView(null);return;}
  const ctrl=new AbortController();let running=false;
  const poll=async()=>{
   if(ctrl.signal.aborted||running||document.visibilityState==='hidden')return;
   running=true;
   try{
    const response=await fetch(url,{method:'GET',credentials:'same-origin',
     cache:'no-store',signal:ctrl.signal});
    if(!response.ok)throw Error('CORRECTIONS_UNAVAILABLE');
    const state=parse(await response.json());
    if(!ctrl.signal.aborted){setView(prev=>prev&&prev.revision>state.revision?prev:state);setError('');}
   }catch{if(!ctrl.signal.aborted)setError('تعذّر تحميل ملاحظات الحصة؛ سنحاول مجددًا.');}
   finally{running=false;}
  };
  void poll();const timer=window.setInterval(()=>void poll(),5000);
  return()=>{ctrl.abort();window.clearInterval(timer);};
 },[role,joined,url,refreshVersion]);
 const add=useCallback(async()=>{
  if(role!=='teacher'||!joined||saving||!text.trim()||!view)return;
  const general=tab==='notes';
  if(!general&&!selectedVerse)return;
  setSaving(true);setError('');setSuccess('');
  try{
   const response=await fetch(url,{
    method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'add',operationId:crypto.randomUUID(),page,
     surah:general?null:selectedVerse!.surah,ayah:general?null:selectedVerse!.ayah,
     kind:general?'general':kind,text:text.trim()}),
   });
   const raw:unknown=await response.json();
   if(!response.ok)throw Error('CORRECTION_WRITE_FAILED');
   const state=parse(raw);setView(state);setText('');
   setSuccess('تم حفظ الملاحظة في سجل الحصة الموثق.');
  }catch{setError('تعذّر حفظ الملاحظة. لم نسجل بيانات غير مؤكدة.');}
  finally{setSaving(false);}
 },[role,joined,saving,text,view,tab,selectedVerse,url,page,kind]);
 if(role==='student')return <aside className={css.notesPanel}>
  <div className={css.panelHeading}><strong>مساحة الطالب</strong></div>
  <p className={css.hint}>تظهر التصحيحات التعليمية بعد أن يعتمد الشيخ تقرير الحصة وينشره.</p>
  <div className={css.selectedAyah}><span>الصفحة المشتركة</span><strong>{page} / 604</strong></div>
  <p className={css.hint}>ملاحظات الشيخ الخاصة لا تظهر للطالب قبل الاعتماد.</p>
 </aside>;
 return <aside className={css.notesPanel} aria-label="لوحة تصحيحات الشيخ الخاصة">
  <div className={css.panelHeading}>
   <strong>ملف الحصة</strong>
   <span>{view?'محفوظ · '+view.items.length+' ملاحظات':'بانتظار سجل الحصة'}</span>
  </div>
  <nav className={css.tabs} role="tablist" aria-label="لوحة الشيخ">
   {([{id:'corrections',label:'الأخطاء'},{id:'notes',label:'الملاحظات'},
    {id:'draft',label:'التقييم'}] as const).map(item=>
    <button key={item.id} type="button" role="tab" aria-selected={tab===item.id}
     onClick={()=>{setTab(item.id);setError('');setSuccess('');}}>
     {item.label}</button>)}
  </nav>
  <div className={css.tabBody}>
   {!joined&&<p className={css.warn}>انضم إلى غرفة الحصة أولًا لحفظ التصحيحات.</p>}
   {tab==='corrections'&&<>
    <div className={css.selectedAyah}><span>الآية المحددة من المصحف المشترك</span>
     <strong>{selectedVerse?selectedVerse.surah+':'+selectedVerse.ayah:'حدد آية أولًا'}</strong></div>
    <label className={css.field}>نوع الخطأ
     <select value={kind} disabled={!joined||saving}
      onChange={e=>setKind(e.target.value as Kind)}>
      {categories.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
     </select></label>
   </>}
   {tab!=='draft'&&<>
    <label className={css.field}>{tab==='notes'?'ملاحظة الشيخ الخاصة':'التصحيح أو ملاحظة التسميع'}
     <textarea rows={3} maxLength={500} value={text} disabled={!joined||saving}
      placeholder={tab==='notes'?'ملاحظة حول الحصة':'اكتب التصحيح المرتبط بالآية'}
      onChange={e=>setText(e.target.value)}/></label>
    <button type="button" className={css.primaryBtn}
     disabled={!joined||saving||!view||!text.trim()||
      (tab==='corrections'&&!selectedVerse)}
     onClick={()=>void add()}>{saving?'جارٍ الحفظ…':'حفظ في سجل الحصة'}</button>
   </>}
   {tab==='draft'&&<p className={css.hint}>عند إنهاء الحصة رسميًا تُنقل التصحيحات المسجلة
     إلى مسودة تقرير خاصة بالشيخ. درجات الحفظ والتلاوة والتجويد تُراجع وتُعتمد
     يدويًا من صفحة التقارير قبل أي نشر للطالب.</p>}
   {error&&<p className={css.warn} role="alert">{error}</p>}
   {success&&<p className={css.hint} role="status">{success}</p>}
   <strong className={extra.notesFooter}>التصحيحات المحفوظة · {view?.items.length??0}</strong>
   {(view?.items??[]).slice().reverse().map(item=><div key={item.id} className={css.errorCard}>
    <b>{allTypes.find(x=>x.value===item.kind)?.label??'تصحيح'}
     {item.surah!==null?' · '+item.surah+':'+item.ayah:''}</b>
    <p>{item.text}</p>
   </div>)}
  </div>
 </aside>;
}
