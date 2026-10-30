'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import type {Room} from 'livekit-client';
import {JoinError,requestMediaTicket,type RoomIdentity} from './media-credentials';
import css from './LiveClassroom.module.css';

type Phase='idle'|'connecting'|'connected'|'reconnecting'|'failed';
type MicPolicy=Readonly<{locked:boolean;revision:number}>;
function verifiedMicPolicy(raw:unknown):MicPolicy{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID_MIC_POLICY');
 const v=raw as Record<string,unknown>;
 const p=v.policy;
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('INVALID_MIC_POLICY');
 const state=p as Record<string,unknown>;
 if(Object.keys(state).length!==2||typeof state.locked!=='boolean'||
  !Number.isSafeInteger(state.revision)||Number(state.revision)<0)
  throw Error('INVALID_MIC_POLICY');
 return state as MicPolicy;
}
function microphonePolicyRoute(identity:RoomIdentity){
 const lesson=encodeURIComponent(identity.lessonId);
 return identity.role==='teacher'?'/v1/teacher/lessons/'+lesson+'/microphone-policy':
  '/v1/me/learners/'+encodeURIComponent(identity.learnerId!)+'/lessons/'+lesson+'/microphone-policy';
}

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
 const [micPolicy,setMicPolicy]=useState<MicPolicy|null>(null);
 const [micPolicyError,setMicPolicyError]=useState(false);
 useEffect(()=>{
   if(!active){setMicPolicy(null);setMicPolicyError(false);return;}
   const controller=new AbortController();
   let running=false;
   const poll=async()=>{
     if(running||controller.signal.aborted||document.visibilityState==='hidden')return;
     running=true;
     try{
       const response=await fetch(microphonePolicyRoute(identity),{
         method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
         signal:controller.signal,
       });
       if(!response.ok)throw Error('MIC_POLICY_UNAVAILABLE');
       const state=verifiedMicPolicy(await response.json());
       if(controller.signal.aborted)return;
       setMicPolicy(prev=>prev&&prev.revision>state.revision?prev:state);
       setMicPolicyError(false);
     }catch{
       if(!controller.signal.aborted)setMicPolicyError(true);
     }finally{running=false;}
   };
   void poll();
   const timer=window.setInterval(()=>void poll(),2_000);
   document.addEventListener('visibilitychange',poll);
   return()=>{controller.abort();window.clearInterval(timer);
    document.removeEventListener('visibilitychange',poll);};
 },[active,identity.lessonId,identity.learnerId,identity.role]);
 useEffect(()=>{
   if(identity.role!=='learner'||!micPolicy?.locked)return;
   // Moderation can silence an already published mic; never re-enable devices
   // when the Sheikh releases the lock. Only the learner can opt back in.
   const media=room.current;
   if(media)void media.localParticipant.setMicrophoneEnabled(false).catch(()=>{});
   setMic(false);
 },[identity.role,micPolicy?.locked]);


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
     media.on(RoomEvent.TrackMuted,(publication,participant)=>{
       if(current===epoch.current&&participant===media.localParticipant&&
        publication.source===Track.Source.Microphone)setMic(false);
     });
     media.on(RoomEvent.TrackUnmuted,(publication,participant)=>{
       if(current===epoch.current&&participant===media.localParticipant&&
        publication.source===Track.Source.Microphone)setMic(true);
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
   if(!room.current||phase!=='connected'||busy||
      (identity.role==='learner'&&(!micPolicy||micPolicy.locked||micPolicyError)))return;
   setBusy(true);setMessage('');
   try{
     await room.current.localParticipant.setMicrophoneEnabled(!mic);
     setMic(!mic);
   }catch(error){setMessage(mediaMessage(error));}
   finally{setBusy(false);}
 },[mic,phase,busy,identity.role,micPolicy,micPolicyError]);
 const toggleCamera=useCallback(async()=>{
   if(!room.current||phase!=='connected'||busy)return;
   setBusy(true);setMessage('');
   try{
     const next=!camera;
     const publication=await room.current.localParticipant.setCameraEnabled(next);
     if(next){
       const preview=publication?.videoTrack?.attach();
       if(preview){
         preview.muted=true;
         preview.autoplay=true;
         if(preview instanceof HTMLVideoElement)preview.playsInline=true;
         preview.style.transform='scaleX(-1)';
         localVideo.current?.replaceChildren(preview);
       }
     }else localVideo.current?.replaceChildren();
     setCamera(next);
   }catch(error){setMessage(mediaMessage(error));}
   finally{setBusy(false);}
 },[camera,phase,busy]);
 const toggleLearnerModeration=useCallback(async()=>{
   if(identity.role!=='teacher'||phase!=='connected'||busy||!micPolicy||micPolicyError)return;
   setBusy(true);setMessage('');
   const release=micPolicy.locked;
   try{
     const response=await fetch(release?microphonePolicyRoute(identity):
       '/v1/teacher/lessons/'+encodeURIComponent(identity.lessonId)+'/mute-learner-microphone',{
       method:'POST',headers:{'content-type':'application/json'},
       body:release?JSON.stringify({action:'release'}):'{}',
       credentials:'same-origin',cache:'no-store',redirect:'error',
     });
     const body:unknown=await response.json();
     if(!response.ok||!body||typeof body!=='object'||Array.isArray(body))
      throw Error('MIC_MODERATION_FAILED');
     const code=(body as Record<string,unknown>).code;
     if(release){
       if(code!=='MIC_POLICY_RELEASED')throw Error('MIC_MODERATION_FAILED');
       const state=verifiedMicPolicy(body);
       setMicPolicy(prev=>prev&&prev.revision>state.revision?prev:state);
       setMessage('تم إلغاء كتم الطالب من جهة الشيخ؛ الطالب يختار تشغيل ميكروفونه بنفسه.');
     }else{
       if(code!=='LEARNER_MICROPHONE_MUTED'&&code!=='NO_LEARNER_MICROPHONE')
        throw Error('MIC_MODERATION_FAILED');
       // The moderation state is committed on LessonDO after provider ACK.
       // Poll the authoritative policy to reconcile even after a UI refresh.
       const state=verifiedMicPolicy(body);
       setMicPolicy(prev=>prev&&prev.revision>state.revision?prev:state);
       setMessage(code==='NO_LEARNER_MICROPHONE'?
        'الطالب لا يبث صوتًا الآن؛ مُنع تشغيله حتى تلغي الكتم.':
        'تم كتم ميكروفون الطالب؛ يمكنك الضغط على «إلغاء كتم الطالب».');
     }
   }catch{
     setMessage('تعذّر تأكيد تغيير كتم الطالب؛ حدّث حالة الاتصال وحاول مرة أخرى.');
   }finally{setBusy(false);}
 },[identity,phase,busy,micPolicy,micPolicyError]);
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
   <button type="button" disabled={phase!=='connected'||busy||
      (identity.role==='learner'&&(!micPolicy||micPolicy.locked||micPolicyError))}
    onClick={()=>void toggleMic()} aria-pressed={mic}>
    {identity.role==='learner'&&micPolicy?.locked?'الشيخ كتم ميكروفونك':
      mic?'إيقاف ميكروفوني':'تشغيل ميكروفوني'}
   </button>
   <button type="button" disabled={phase!=='connected'||busy}
    onClick={()=>void toggleCamera()} aria-pressed={camera}>
    {camera?'إيقاف كاميرتي':'تشغيل كاميرتي'}
   </button>
   {identity.role==='teacher'&&<button type="button" className={css.extraAction}
    disabled={phase!=='connected'||busy||!micPolicy||micPolicyError}
    onClick={()=>void toggleLearnerModeration()}>
    {micPolicy?.locked?'إلغاء كتم الطالب':'كتم ميكروفون الطالب'}
   </button>}
   {identity.role==='learner'&&micPolicy?.locked&&
    <p className={css.mediaPrivacy} role="status">الشيخ كتم صوتك. عند إلغاء الكتم يمكنك تشغيل ميكروفونك بنفسك.</p>}
   {micPolicyError&&<p role="status" className={css.mediaPrivacy}>
    تعذّر تحديث حالة كتم الطالب؛ سنحاول مجددًا.</p>}
   {audioBlocked&&<button type="button" onClick={()=>void enableRemoteAudio()}>
    تشغيل صوت الطرف الآخر
   </button>}
  </div>
  <p className={css.mediaPrivacy}>لا تسجيل ولا تشغيل أجهزة عن بُعد. إيقاف الوسائط لا ينهي الحصة.</p>
 </section>;
}
