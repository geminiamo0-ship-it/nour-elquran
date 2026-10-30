'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import type {Room} from 'livekit-client';
import {JoinError,requestMediaTicket,type RoomIdentity} from './media-credentials';

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
export function LiveLessonMedia({identity,active,compact=false}:{
 identity:RoomIdentity;active:boolean;compact?:boolean;
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
           element.style.width='100%';element.style.height='100%';element.style.objectFit='cover';
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
   if(!room.current||phase!=='connected'||busy)return;
   setBusy(true);setMessage('');
   try{
     await room.current.localParticipant.setMicrophoneEnabled(!mic);
     setMic(!mic);
   }catch(error){setMessage(mediaMessage(error));}
   finally{setBusy(false);}
 },[mic,phase,busy]);
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
         preview.style.width='100%';preview.style.height='100%';preview.style.objectFit='cover';
         localVideo.current?.replaceChildren(preview);
       }
     }else localVideo.current?.replaceChildren();
     setCamera(next);
   }catch(error){setMessage(mediaMessage(error));}
   finally{setBusy(false);}
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

 return <section aria-label="الصوت والفيديو المباشر" data-media-layout={compact?'compact':'full'} style={{
   border:'1px solid var(--border,#e4d9c0)',borderRadius:10,padding:compact?5:14,
   background:'var(--paper-2,#fffdf7)',display:compact?'flex':'grid',
   flexDirection:compact?'column':undefined,gap:compact?4:12,
   height:compact?'100%':undefined,minHeight:compact?0:undefined,
   overflow:compact?'hidden':undefined,
 }}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:compact?5:12,
     flexWrap:compact?'nowrap':'wrap',flex:'0 0 auto'}}>
     <div style={{minWidth:0}}>
       <h2 style={{margin:0,fontSize:compact?'0.78rem':'1.2rem'}}>{compact?'الصوت والفيديو':'الصوت والفيديو — LiveKit Cloud'}</h2>
       <p style={{margin:compact?'1px 0 0':'4px 0 0',fontSize:compact?10:13}}>
         {phase==='connecting'?'جارٍ الاتصال الآمن…':
          phase==='connected'?(compact?'متصل بالصوت والفيديو':'متصل بالصوت والفيديو، والأجهزة مغلقة حتى تختار تشغيلها.'):
          phase==='reconnecting'?'الإنترنت غير مستقر؛ جارٍ استعادة الاتصال…':
          phase==='failed'?'الاتصال غير متاح حاليًا.':
          (compact?'الأجهزة مغلقة افتراضيًا':'لا يتم تشغيل أي كاميرا أو ميكروفون تلقائيًا.')}
       </p>
     </div>
     {phase==='connected'||phase==='reconnecting'?
       <button type="button" style={compact?{fontSize:10,padding:'3px 5px'}:undefined} onClick={stop}>إنهاء اتصال الصوت والفيديو</button>:
       <button type="button" style={compact?{fontSize:10,padding:'3px 5px'}:undefined} disabled={!active||busy} onClick={()=>void connect()}>
         {busy?'جارٍ الاتصال…':'دخول الصوت والفيديو'}
       </button>}
   </div>
   {message&&<p role="alert" style={{color:'#923e29',margin:0}}>{message}</p>}
   <div style={{display:'grid',gridTemplateColumns:compact?'minmax(0,1fr) 76px':'repeat(auto-fit,minmax(min(100%,220px),1fr))',
     gap:compact?5:10,flex:compact?'1 1 auto':undefined,minHeight:compact?0:undefined}}>
     <div style={{minHeight:compact?0:150,background:'#21382e',borderRadius:8,overflow:'hidden',position:'relative'}}>
       <div ref={remoteVideo} aria-label="فيديو الطرف الآخر" style={{
         width:'100%',height:compact?'100%':150,display:'flex',alignItems:'center',justifyContent:'center',
       }}/>
       <span style={{position:'absolute',bottom:6,right:8,color:'#fff',fontSize:12}}>
         {identity.role==='learner'?'كاميرا الشيخ':'كاميرا الطالب'}
       </span>
     </div>
     <div style={{minHeight:compact?0:150,background:'#30493c',borderRadius:8,overflow:'hidden',position:'relative'}}>
       <div ref={localVideo} aria-label="معاينة كاميرتي" style={{
         width:'100%',height:compact?'100%':150,display:'flex',alignItems:'center',justifyContent:'center',
       }}/>
       <span style={{position:'absolute',bottom:6,right:8,color:'#fff',fontSize:12}}>كاميرتي</span>
     </div>
   </div>
   <div ref={remoteAudio} aria-label="صوت الطرف الآخر"/>
   <div style={{display:'flex',gap:compact?4:10,flexWrap:'wrap',flex:'0 0 auto'}}>
     <button type="button" disabled={phase!=='connected'||busy}
       onClick={()=>void toggleMic()} aria-pressed={mic}>
       {mic?'إيقاف ميكروفوني':'تشغيل ميكروفوني'}
     </button>
     <button type="button" disabled={phase!=='connected'||busy}
       onClick={()=>void toggleCamera()} aria-pressed={camera}>
       {camera?'إيقاف كاميرتي':'تشغيل كاميرتي'}
     </button>
     {identity.role==='teacher'&&<button type="button"
       disabled={phase!=='connected'||busy} onClick={()=>void muteLearner()}>
       كتم ميكروفون الطالب
     </button>}
     {audioBlocked&&<button type="button" onClick={()=>void enableRemoteAudio()}>
       تشغيل صوت الطرف الآخر
     </button>}
   </div>
   <p style={{fontSize:12,margin:0,color:'var(--ink-2,#47544a)',display:compact?'none':undefined}}>
     لا يوجد تسجيل صوت أو فيديو. إيقاف اتصال الوسائط لا يُنهي الحصة التعليمية.
     لا يُعد هذا الاتصال دليل حضور رسمي. يمكن للشيخ كتم ميكروفون الطالب فقط؛ لا يستطيع تشغيله عن بُعد.
   </p>
 </section>;
}
