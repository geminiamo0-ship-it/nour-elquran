'use client';
import { useEffect,useRef,useState } from 'react';
import css from './TrainingWorkspace.module.css';

/** Explicit, private browser-only audio rehearsal. Never uploaded or saved to a server. */
export function TrainingVoicePractice(){
  const recorder=useRef<MediaRecorder|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const urlRef=useRef<string|null>(null);
  const [state,setState]=useState<'idle'|'recording'|'ready'|'error'>('idle');
  const [audioUrl,setAudioUrl]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>()=> {
    recorder.current?.stop();
    stream.current?.getTracks().forEach(t=>t.stop());
    if(urlRef.current) URL.revokeObjectURL(urlRef.current);
  },[]);

  async function begin(){
    setError('');
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined'){
      setState('error');setError('تسجيل الصوت غير مدعوم في المتصفح الحالي، أو يحتاج اتصال HTTPS.');return;
    }
    try {
      if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null;setAudioUrl('');}
      const opened=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      stream.current=opened;
      const media=new MediaRecorder(opened);
      const chunks:Blob[]=[];
      media.ondataavailable=event=>{if(event.data.size>0)chunks.push(event.data);};
      media.onstop=()=>{
        opened.getTracks().forEach(t=>t.stop());
        if(stream.current===opened)stream.current=null;
        if(chunks.length){
          const url=URL.createObjectURL(new Blob(chunks,{type:media.mimeType||'audio/webm'}));
          urlRef.current=url;setAudioUrl(url);setState('ready');
        }else setState('idle');
      };
      media.onerror=()=>{setState('error');setError('حدث خطأ أثناء التسجيل؛ لم يتم إرسال أي صوت.');};
      recorder.current=media;
      media.start();setState('recording');
    }catch{
      stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
      setState('error');setError('تعذّر السماح للميكروفون. يمكنك متابعة التدريب بدون تسجيل.');
    }
  }
  function stop(){if(recorder.current?.state==='recording')recorder.current.stop();}
  function clear(){
    if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null;}
    setAudioUrl('');setState('idle');setError('');
  }
  return <section className={css.voiceCard} aria-label="التسميع الذاتي">
    <div className={css.rowBetween}><strong>تسميع ذاتي اختياري</strong><span className={css.subtle}>داخل هذا الجهاز فقط</span></div>
    <p>سجّل تلاوتك واستمع إليها للمراجعة. لا يتم رفعها للشيخ ولا تخزينها على الخادم.</p>
    <div className={css.actions}>
      {state!=='recording'?<button type="button" onClick={()=>void begin()} className={css.outlineButton}>
        تسجيل تلاوة جديدة</button>:
        <button type="button" onClick={stop} className={css.primaryButton}>إيقاف التسجيل</button>}
      {audioUrl&&<button type="button" className={css.outlineButton} onClick={clear}>مسح التسجيل</button>}
    </div>
    {state==='recording'&&<p role="status" className={css.recording}>الميكروفون قيد التسجيل… اضغط «إيقاف التسجيل» عند الانتهاء.</p>}
    {audioUrl&&<audio controls preload="metadata" src={audioUrl} aria-label="استمع إلى تسجيلك الشخصي" className={css.voiceAudio}/>}
    {error&&<p role="alert" className={css.error}>{error}</p>}
  </section>;
}
