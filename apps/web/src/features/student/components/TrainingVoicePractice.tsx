'use client';
import {useEffect,useRef,useState} from 'react';
import {LOCAL_REHEARSAL_MAX_BYTES,LOCAL_REHEARSAL_MAX_MS,
 localRehearsalLimit,type LocalRehearsalLimit} from './local-rehearsal-limits';
import css from './TrainingWorkspace.module.css';

type Phase='idle'|'requesting'|'recording'|'ready'|'error';
const limitMessage=(reason:LocalRehearsalLimit)=>{
 if(reason==='too_large')return 'تجاوز التسجيل الحد الأقصى ٨ ميجابايت، وتم تجاهله دون إرساله أو حفظه.';
 if(reason==='too_long')return 'تجاوز التسجيل ٤ دقائق، وتم تجاهله دون إرساله أو حفظه.';
 return 'حدث خطأ أثناء التسجيل؛ لم يتم إرسال أي صوت.';
};

/** Explicit browser-only rehearsal. Never connects to R2, an API, or a Sheikh. */
export function TrainingVoicePractice(){
 const recorder=useRef<MediaRecorder|null>(null);
 const stream=useRef<MediaStream|null>(null);
 const urlRef=useRef<string|null>(null);
 const timeout=useRef<ReturnType<typeof setTimeout>|null>(null);
 const generation=useRef(0);
 const mounted=useRef(true);
 const pending=useRef(false);
 const [state,setState]=useState<Phase>('idle');
 const [audioUrl,setAudioUrl]=useState('');
 const [error,setError]=useState('');

 useEffect(()=>{
  mounted.current=true;
  return ()=>{
   mounted.current=false;
   generation.current+=1; // async microphone grant after unmount must be released
   if(timeout.current!==null){clearTimeout(timeout.current);timeout.current=null;}
   // Cancel the live recorder and all microphone tracks on navigation.
   const media=recorder.current;recorder.current=null;
   if(media&&media.state!=='inactive'){try{media.stop();}catch{/* already stopped */}}
   stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
   if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null;}
  };
 },[]);

 function discardPlayback(){
  if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null;}
  setAudioUrl('');
 }

 async function begin(){
  if(pending.current||recorder.current||!mounted.current)return;
  pending.current=true;
  const current=++generation.current;
  discardPlayback();setError('');setState('requesting');
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
   pending.current=false;setState('error');
   setError('تسجيل الصوت غير مدعوم في المتصفح الحالي، أو يحتاج اتصال HTTPS.');
   return;
  }
  let opened:MediaStream|null=null;
  try{
   // The user pressed the button; no automatic microphone access on mount.
   opened=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
   if(!mounted.current||generation.current!==current){
    opened.getTracks().forEach(t=>t.stop());return;
   }
   stream.current=opened;
   const media=new MediaRecorder(opened);
   const chunks:Blob[]=[];
   let totalBytes=0,failed:LocalRehearsalLimit|null=null;
   const startedAt=Date.now();
   const safeStop=()=>{
    if(media.state!=='inactive'){try{media.stop();}catch{/* already stopped */}}
   };
   media.ondataavailable=event=>{
    if(!mounted.current||generation.current!==current||failed||!event.data.size)return;
    const result=localRehearsalLimit(totalBytes,event.data.size,Date.now()-startedAt);
    if(result!=='ok'){failed=result;chunks.length=0;safeStop();return;}
    totalBytes+=event.data.size;chunks.push(event.data);
   };
   media.onerror=()=>{failed='invalid';chunks.length=0;safeStop();};
   media.onstop=()=>{
    if(timeout.current!==null){clearTimeout(timeout.current);timeout.current=null;}
    opened?.getTracks().forEach(t=>t.stop());
    if(stream.current===opened)stream.current=null;
    if(recorder.current===media)recorder.current=null;
    if(!mounted.current||generation.current!==current)return;
    const finalCheck=localRehearsalLimit(totalBytes,0,Date.now()-startedAt);
    const issue=failed??(finalCheck==='ok'?null:finalCheck);
    if(issue){setState('error');setError(limitMessage(issue));return;}
    if(!chunks.length){setState('error');setError('التسجيل فارغ. حاول مرة أخرى بعد السماح للميكروفون.');return;}
    const url=URL.createObjectURL(new Blob(chunks,{type:media.mimeType||'audio/webm'}));
    urlRef.current=url;setAudioUrl(url);setState('ready');
   };
   recorder.current=media;
   // Time slices allow a running byte cap, not an unbounded final Blob.
   media.start(1000);setState('recording');
   timeout.current=setTimeout(safeStop,LOCAL_REHEARSAL_MAX_MS);
  }catch{
   opened?.getTracks().forEach(t=>t.stop());
   if(stream.current===opened)stream.current=null;
   recorder.current=null;
   if(mounted.current&&generation.current===current){
    setState('error');setError('تعذّر تشغيل الميكروفون. يمكنك متابعة التدريب بدون تسجيل.');
   }
  }finally{pending.current=false;}
 }
 function stop(){
  const media=recorder.current;
  if(media&&media.state==='recording'){try{media.stop();}catch{/* already stopped */}}
 }
 function clear(){discardPlayback();setState('idle');setError('');}
 return <section className={css.voiceCard} aria-label="التسميع الذاتي">
  <div className={css.rowBetween}><strong>تسميع ذاتي اختياري</strong>
   <span className={css.subtle}>داخل هذا الجهاز فقط</span></div>
  <p>سجّل تلاوتك واستمع إليها للمراجعة. لا يتم رفعها للشيخ ولا تخزينها على الخادم.</p>
  <p className={css.subtle}>الحد الأقصى ٤ دقائق أو ٨ ميجابايت. إذا تجاوزته يُحذف التسجيل الحالي.</p>
  <div className={css.actions}>
   {state==='recording'?
    <button type="button" onClick={stop} className={css.primaryButton}>إيقاف التسجيل</button>:
    <button type="button" onClick={()=>void begin()} disabled={state==='requesting'}
     className={css.outlineButton}>{state==='requesting'?'جارٍ طلب الميكروفون...':'تسجيل تلاوة جديدة'}</button>}
   {audioUrl&&<button type="button" className={css.outlineButton}
    onClick={clear}>مسح التسجيل</button>}
  </div>
  {state==='recording'&&<p role="status" className={css.recording}>
   الميكروفون قيد التسجيل… اضغط «إيقاف التسجيل» عند الانتهاء.</p>}
  {audioUrl&&<audio controls preload="metadata" src={audioUrl}
   aria-label="استمع إلى تسجيلك الشخصي" className={css.voiceAudio}/>}
  {error&&<p role="alert" className={css.error}>{error}</p>}
 </section>;
}
