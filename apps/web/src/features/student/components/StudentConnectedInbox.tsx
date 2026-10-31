'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {inboxClient,type InboxNotice} from '../../shared';
import styles from '../StudentPortal.module.css';

const client=inboxClient();
type State={status:'loading'|'ready'|'error';items:readonly InboxNotice[]};
/** Signed per-learner inbox. Mount with key={learnerId} so sibling switches
 * cannot show a previous child's notices while the next request is pending.
 */
export function StudentConnectedInbox({learnerId}:{learnerId:string}){
 const [state,setState]=useState<State>({status:'loading',items:[]});
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [filter,setFilter]=useState<'all'|'unread'>('all');
 const [refresh,setRefresh]=useState(0);
 const ids=useRef(new Map<string,string>());
 useEffect(()=>{
  const controller=new AbortController();
  setState({status:'loading',items:[]});setError('');
  void client.owner(learnerId,controller.signal).then(items=>{
   if(!controller.signal.aborted)setState({status:'ready',items});
  }).catch(()=>{
   if(!controller.signal.aborted)setState({status:'error',items:[]});
  });
  return()=>controller.abort();
 },[learnerId,refresh]);
 async function mark(item:InboxNotice,read:boolean){
  if(busy!==null)return;
  setBusy(item.id);setError('');
  const key=item.id+':'+item.revision+':'+(read?'read':'unread');
  if(!ids.current.has(key))ids.current.set(key,crypto.randomUUID());
  try{
   const updated=await client.mark('owner',learnerId,item,read,ids.current.get(key)!);
   setState(current=>({...current,items:current.items.map(v=>v.id===item.id?updated:v)}));
   ids.current.delete(key);
  }catch{
   setError('لم نتمكن من تأكيد تغيير حالة الإشعار؛ حدّث القائمة للتحقق من الخادم.');
  }finally{setBusy(null);}
 }
 const visible=filter==='all'?state.items:state.items.filter(item=>!item.read);
 return <section className={styles.panel} aria-label="إشعارات الطالب الحقيقية" dir="rtl">
  <div className={styles.panelHead}><div>
   <span className={styles.eyebrow}>إشعاراتي</span>
   <h2>التنبيهات الخاصة بهذا الطالب</h2></div>
   <button type="button" className={styles.outlineButton} disabled={busy!==null}
    onClick={()=>{ids.current.clear();setRefresh(n=>n+1);}}>تحديث</button>
  </div>
  <p>الحصص والواجبات المؤكدة من الخادم فقط. إشعارات WhatsApp غير مفعلة بعد.</p>
  <div className={styles.actionRow}>
   <button type="button" className={styles.outlineButton} aria-pressed={filter==='all'}
    onClick={()=>setFilter('all')}>الكل</button>
   <button type="button" className={styles.outlineButton} aria-pressed={filter==='unread'}
    onClick={()=>setFilter('unread')}>غير المقروء</button>
  </div>
  {state.status==='loading'?<p role="status">جارٍ قراءة الإشعارات الموثقة…</p>:
   state.status==='error'?<p role="alert">تعذّر الوصول إلى إشعارات هذا الطالب، ولن نعرض إشعارات افتراضية.</p>:
   <><p role="status">غير مقروء: {state.items.filter(i=>!i.read).length}</p>
    {visible.length?<div className={styles.lessonList}>{visible.slice(0,12).map(item=>
     <article className={styles.lessonRow} key={item.id}>
      <div className={styles.lessonInfo}>
       <strong>{item.title}</strong><span>{item.detail}</span>
       <small>{new Date(item.createdAtMs).toLocaleString('ar-EG')}</small>
      </div>
      <div className={styles.actionRow}>
       <Link href={item.kind==='assignment_published'?'/student/training':'/student/lessons'}
        className={styles.outlineButton}>فتح</Link>
       <button type="button" className={styles.outlineButton} disabled={busy!==null}
        onClick={()=>void mark(item,!item.read)}>
        {busy===item.id?'جارٍ التأكيد…':item.read?'غير مقروء':'مقروء'}
       </button>
      </div>
     </article>)}</div>:<p className={styles.emptyBox}>لا توجد إشعارات حقيقية بهذا التصنيف.</p>}
   </>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
