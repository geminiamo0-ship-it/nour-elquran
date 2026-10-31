'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {inboxClient,type InboxNotice} from '../shared';
import css from './TeacherReadOnly.module.css';

const client=inboxClient();
type View={phase:'loading'|'loaded'|'error';items:readonly InboxNotice[]};
export function TeacherConnectedInbox(){
 const [view,setView]=useState<View>({phase:'loading',items:[]});
 const [filter,setFilter]=useState<'all'|'unread'>('all');
 const [busy,setBusy]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const [retry,setRetry]=useState(0);
 const operation=useRef(new Map<string,string>());
 useEffect(()=>{
  const ctrl=new AbortController();
  setView({phase:'loading',items:[]});setMessage('');
  void client.teacher(ctrl.signal).then(items=>{
   if(!ctrl.signal.aborted)setView({phase:'loaded',items});
  }).catch(()=>{
   if(!ctrl.signal.aborted)setView({phase:'error',items:[]});
  });
  return()=>ctrl.abort();
 },[retry]);
 const shown=filter==='all'?view.items:view.items.filter(i=>!i.read);
 async function mark(item:InboxNotice,read:boolean){
  if(busy!==null)return;
  setBusy(item.id);setMessage('');
  const key=item.id+':'+item.revision+':'+(read?'read':'unread');
  if(!operation.current.has(key))operation.current.set(key,crypto.randomUUID());
  try{
   const next=await client.mark('teacher',null,item,read,operation.current.get(key)!);
   setView(prev=>({...prev,items:prev.items.map(i=>i.id===item.id?next:i)}));
   operation.current.delete(key);
  }catch{
   // No optimistic updates. After an ambiguous network failure, reread D1
   // rather than creating a different operationId for a possibly committed write.
   setMessage('تعذّر تأكيد قراءة الإشعار؛ حدّث السجل قبل إعادة المحاولة.');
  }finally{setBusy(null);}
 }
 return <section className={css.card} dir="rtl" aria-label="إشعارات الشيخ الموثقة">
  <div className={css.heading}><h1>الإشعارات</h1><span>سجل D1 الحقيقي</span></div>
  <p>إشعارات ناتجة عن حجز أو تغيير حصة أو نشر واجب فعلي.
   إشعارات WhatsApp والتذكيرات التلقائية ليست مفعلة بعد.</p>
  <div className={css.actions}>
   <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>الكل</button>
   <button type="button" aria-pressed={filter==='unread'} onClick={()=>setFilter('unread')}>غير المقروء</button>
   <button type="button" disabled={busy!==null} onClick={()=>{operation.current.clear();setRetry(v=>v+1);}}>تحديث من الخادم</button>
  </div>
  {view.phase==='loading'?<p role="status">جارٍ التحقق من الإشعارات…</p>:
   view.phase==='error'?<p role="alert">تعذّر تحميل الإشعارات من الخادم. لا توجد بيانات تجريبية.</p>:
   <><p role="status">غير مقروء: {view.items.filter(i=>!i.read).length}</p>
    {shown.length?<div className={css.list}>{shown.map(item=>
     <article className={css.row} key={item.id}>
      <div><strong>{item.title}</strong><p>{item.detail}</p>
       <small>{new Date(item.createdAtMs).toLocaleString('ar-EG')}</small></div>
      <div className={css.actions}>
       <Link href={item.kind==='assignment_published'?'/teacher/assignments':'/teacher/schedule'}>فتح القسم</Link>
       <button type="button" disabled={busy!==null} onClick={()=>void mark(item,!item.read)}>
        {busy===item.id?'جارٍ التأكيد…':item.read?'تعليم كغير مقروء':'تعليم كمقروء'}
       </button>
      </div>
     </article>)}</div>:<p className={css.empty}>لا توجد إشعارات فعلية بهذا التصنيف.</p>}
   </>}
  {message&&<p role="alert">{message}</p>}
 </section>;
}
