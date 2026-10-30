'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import type {Room} from 'livekit-client';
import {JoinError,requestMediaTicket,type RoomIdentity} from './media-credentials';
import {setDeviceWithEpochGuard} from './media-device-safety';
import css from './LiveClassroom.module.css';

type Phase='idle'|'connecting'|'connected'|'reconnecting'|'failed';
function mediaMessage(error:unknown):string {
  if(error instanceof JoinError){
    if(error.code==='UNAVAILABLE')return 'الصوت والفيديو غير مفعّلين في هذه البيئة حتى يتم توصيل LiveKit Cloud.';
    if(error.code==='UNAUTHORIZED')return 'انتهى الإذن بالدخول؛ غادر الغرفة ثم انضم مرة أخرى.';
    if(error.code==='NETWORK')return 'تعذر الوصول إلى الخادم. تحقق من الإنترنت وأعد المحاولة.';
  }
  if(error instanceof DOMException&&['NotAllowedError','PermissionDeniedError'].includes(error.name))
    return 'المتصفح رفض صلاحية الجهاز. يمكنك الاستمرار بالصوت فقط أو بدون كاميرا.';
  return 'لم يكتمل الاتصال أو تفعيل الجهاز. يمكنك إعادة المحاولة بدون تغيير الحصة.';
}
/** Real Cloud provider media; this is NOT a Start/End or attendance control.
 * Source of truth for teaching/Quran remains the Cloudflare Lesson Durable Object.
 */
export function LiveLessonMedia({identity,active,embedded=false}:{
 identity:RoomIdentity;active:boolean;embedded?:boolean;
}){
 const room=useRef<Room|null>(null);
 const epoch=useRef(0);
 const remoteVideo=useRef<HTMLDivElement>(null);
 const remoteAudio=useRef<HTMLDivElement>(null);
 const localVideo=useRef<HTMLDivElement>(null);
 const [phase,setPhase]=useState<Phase>('idle');
 const [mic,setMic]=useState(false);
 const [camera,setCamera]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [audioBlocked,setAudioBlocked]=useState(false);

 const stop=useCallback(()=>{
   epoch.current++;
   const old=room.current;
   room.current=null;
   if(old){
     old.removeAllListeners();
     void old.localParticipant.setMicrophoneEnabled(false).catch(()=>{});
     void old.localParticipant.setCameraEnabled(false).catch(()=>{});
     void old.disconnect();
   }
   remoteVideo.current?.replaceChildren();
   remoteAudio.current?.replaceChildren();
   localVideo.current?.replaceChildren();
   setMic(false);setCamera(false);setAudioBlocked(false);setPhase('idle');setBusy(false);
 },[]);
 useEffect(()=>{
   if(!active)stop();
 },[active,stop]);
 useEffect(()=>()=>{stop();},[stop]);

 const connect=useCallback(async()=>{
   if(!active||room.current||busy)return;
   const current=++epoch.current;
   setBusy(true);setMessage('');setPhase('connecting');
   let pending:Room|null=null;
   try{
     const ticket=await requestMediaTicket(identity);
     if(current!==epoch.current)return;
     const {Room,RoomEvent,Track}=await import('livekit-client');
     if(current!==epoch.current)return;
     pending=new Room({adaptiveStream:true,dynacast:true,stopLocalTrackOnUnpublish:true});
     const media=pending;
     room.current=media;

     // Never auto-enable camera or microphone at connection. Devices
     // are enabled only by the participant's explicit local button.
     media.on(RoomEvent.Reconnecting,()=>{if(current===epoch.current)setPhase('reconnecting');});
     media.on(RoomEvent.Reconnected,()=>{if(current===epoch.current)setPhase('connected');});
     media.on(RoomEvent.Disconnected,()=>{
       if(current!==epoch.current)return;
       room.current=null;
       remoteVideo.current?.replaceChildren();remoteAudio.current?.replaceChildren();
       localVideo.current?.replaceChildren();
       setMic(false);setCamera(false);setPhase('failed');
       setMessage('انقطع اتصال الوسائط؛ يلزم إعادة تصريح الدخول.');
     });
     media.on(RoomEvent.TrackSubscribed,(track)=>{
       if(current!==epoch.current)return;
       if(track.kind!==Track.Kind.Audio&&track.kind!==Track.Kind.Video)return;
       const element=track.attach();
       // Remote audio autoplay can be blocked on mobile; the user can
       // explicitly tap "تشغيل صوت الطرف الآخر" to resume it.
       if(track.kind===Track.Kind.Audio){
         if(element instanceof HTMLAudioElement){
           element.autoplay=true;
           void element.play().catch(()=>setAudioBlocked(true));
         }
         remoteAudio.current?.appendChild(element);
       }else{
         if(element instanceof HTMLVideoElement){
           element.autoplay=true;element.playsInline=true;
         }
         remoteVideo.current?.appendChild(element);
       }
     });
     media.on(RoomEvent.TrackUnsubscribed,track=>{
       for(const element of track.detach())element.remove();
     });
     media.on(RoomEvent.ParticipantDisconnected,()=>{
       if(current===epoch.current)remoteVideo.current?.replaceChildren();
     });
     await media.connect(ticket.serverUrl,ticket.participantToken,{
       autoSubscribe:true,
     });
     if(current!==epoch.current){
       await media.disconnect();return;
     }
     setPhase('connected');
   }catch(error){
     if(current!==epoch.current)return;
     if(pending){pending.removeAllListeners();void pending.disconnect();}
     room.current=null;
     setMessage(mediaMessage(error));setPhase('failed');
   }finally{
     if(current===epoch.current)setBusy(false);
   }
 },[active,busy,identity]);

 const toggleMic=useCallback(async()=>{
   const media=room.current;
   if(!media||phase!=='connected'||busy)return;
   const current=epoch.current;
   const next=!mic;
   setBusy(true);setMessage('');
   try{
     const result=await setDeviceWithEpochGuard(next,
       enabled=>media.localParticipant.setMicrophoneEnabled(enabled),
       ()=>current===epoch.current&&room.current===media,
       publication=>publication?.audioTrack?.stop());
     if(result.current)setMic(next);
   }catch(error){
     if(current===epoch.current&&room.current===media)setMessage(mediaMessage(error));
   }finally{
     if(current===epoch.current&&room.current===media)setBusy(false);
   }
 },[mic,phase,busy]);
 const toggleCamera=useCallback(async()=>{
   const media=room.current;
   if(!media||phase!=='connected'||busy)return;
   const current=epoch.current;
   const next=!camera;
   setBusy(true);setMessage('');
   try{
     const result=await setDeviceWithEpochGuard(next,
       enabled=>media.localParticipant.setCameraEnabled(enabled),
       ()=>current===epoch.current&&room.current===media,
       publication=>publication?.videoTrack?.stop());
     if(!result.current)return;
     if(next){
       const preview=result.value?.videoTrack?.attach();
       if(preview){
         preview.muted=true;
         preview.autoplay=true;
         if(preview instanceof HTMLVideoElement)preview.playsInline=true;
         preview.style.transform='scaleX(-1)';
         localVideo.current?.replaceChildren(preview);
       }
     }else localVideo.current?.replaceChildren();
     setCamera(next);
   }catch(error){
     if(current===epoch.current&&room.current===media)setMessage(mediaMessage(error));
   }finally{
     if(current===epoch.current&&room.current===media)setBusy(false);
   }
 },[camera,phase,busy]);
 const muteLearner=useCallback(async()=>{
   if(identity.role!=='teacher'||phase!=='connected'||busy)return;
   setBusy(true);setMessage('');
   try{
     const response=await fetch(
       '/v1/teacher/lessons/'+encodeURIComponent(identity.lessonId)+'/mute-learner-microphone',{
         method:'POST',headers:{'content-type':'application/json'},body:'{}',
         credentials:'same-origin',cache:'no-store',redirect:'error',
       });
     const body:unknown=await response.json();
     if(!response.ok)throw new Error('MUTE_FAILED');
     if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('MUTE_FAILED');
     const code=(body as Record<string,unknown>).code;
     if(code==='LEARNER_MICROPHONE_MUTED')
       setMessage('تم تأكيد كتم ميكروفون الطالب من الخادم.');
     else if(code==='NO_LEARNER_MICROPHONE')
       setMessage('الطالب لا يبث صوتًا الآن.');
     else throw new Error('MUTE_FAILED');
   }catch{
     setMessage('تعذّر تأكيد كتم ميكروفون الطالب. لم نحاول تشغيل أي جهاز عن بُعد.');
   }finally{setBusy(false);}
 },[identity,phase,busy]);
 const enableRemoteAudio=useCallback(async()=>{
   const media=room.current;if(!media)return;
   try{
     await media.startAudio();
     for(const child of remoteAudio.current?.children??[]){
       if(child instanceof HTMLAudioElement)await child.play();
     }
     setAudioBlocked(false);
   }catch{setAudioBlocked(true);}
 },[]);

 return <section aria-label="الصوت والفيديو المباشر" className={css.mediaRoot}
  data-media-phase={phase} data-embedded={embedded?"true":"false"}>
  <div className={css.mediaTop}>
   <strong>الصوت والفيديو · LiveKit Cloud</strong>
   <span role="status">{phase==='connected'?'متصل بالصوت والفيديو — الأجهزة تحت تحكمك':
    phase==='connecting'?'جارٍ الاتصال الآمن…':phase==='reconnecting'?'جارٍ استعادة الاتصال…':
    phase==='failed'?'الاتصال غير متاح حاليًا':'الأجهزة مغلقة افتراضيًا'}</span>
  </div>
  {message&&<p role="alert" className={css.mediaAlert}>{message}</p>}
  <div className={css.videoGrid}>
   <div className={css.remoteCard}>
    <div ref={remoteVideo} aria-label="فيديو الطرف الآخر" className={css.videoTarget}/>
    <span className={css.videoLabel}>{identity.role==='learner'?'كاميرا الشيخ':'كاميرا الطالب'}</span>
   </div>
   <div className={css.localCard}>
    <div ref={localVideo} aria-label="معاينة كاميرتي" className={css.videoTarget}/>
    <span className={css.videoLabel}>معاينتي</span>
   </div>
  </div>
  <div ref={remoteAudio} aria-label="صوت الطرف الآخر" className={css.remoteAudio}/>
  <div className={css.mediaActions}>
   {phase==='connected'||phase==='reconnecting'?
    <button type="button" onClick={stop}>إنهاء اتصال الصوت والفيديو</button>:
    <button type="button" disabled={!active||busy} onClick={()=>void connect()}>
     {busy?'جارٍ الاتصال…':'دخول الصوت والفيديو'}
    </button>}
   <button type="button" disabled={phase!=='connected'||busy}
    onClick={()=>void toggleMic()} aria-pressed={mic}>
    {mic?'إيقاف ميكروفوني':'تشغيل ميكروفوني'}
   </button>
   <button type="button" disabled={phase!=='connected'||busy}
    onClick={()=>void toggleCamera()} aria-pressed={camera}>
    {camera?'إيقاف كاميرتي':'تشغيل كاميرتي'}
   </button>
   {identity.role==='teacher'&&<button type="button" className={css.extraAction}
    disabled={phase!=='connected'||busy} onClick={()=>void muteLearner()}>
    كتم ميكروفون الطالب
   </button>}
   {audioBlocked&&<button type="button" onClick={()=>void enableRemoteAudio()}>
    تشغيل صوت الطرف الآخر
   </button>}
  </div>
  <p className={css.mediaPrivacy}>لا تسجيل ولا تشغيل أجهزة عن بُعد. إيقاف الوسائط لا ينهي الحصة.</p>
 </section>;
}
