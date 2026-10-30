/** Authorized Sheikh may request ONLY server-side mute of learner microphone.
 * Browser cannot pass track SID, participant identity or a false/unmute flag.
 * No camera mute, remote unmute, recording or moderation of another lesson.
 */
import type {Env} from '../bindings.ts';
import {checkTeacherClassroomAccess} from '../classroom-access.ts';
import {forwardVerifiedPresence} from './presence.ts';
import {liveKitActorNames,mediaLessonWindow,validatedLiveKitConfig} from './livekit-token.ts';
import {liveKitRoomAdminToken,liveKitRoomServiceURL} from './livekit-admin.ts';
import {forwardVerifiedMicPolicy,type MicPolicy} from './mic-policy.ts';

type MuteResult=Readonly<{status:200|404|409|503;code:string;mutedTracks?:number;policy?:MicPolicy}>;
const sidPattern=/^[A-Za-z0-9_-]{1,128}$/;
export function microphoneSids(body:unknown,expectedIdentity:string):string[]|null{
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const data=body as Record<string,unknown>;
 if(!Array.isArray(data.participants)||data.participants.length>100)return null;
 const persons=data.participants.filter(x=>x&&typeof x==='object'&&
   !Array.isArray(x)&&(x as Record<string,unknown>).identity===expectedIdentity);
 if(persons.length===0)return [];
 if(persons.length!==1)return null;
 const tracks=(persons[0] as Record<string,unknown>).tracks;
 if(!Array.isArray(tracks)||tracks.length>24)return null;
 const sids:string[]=[];
 for(const track of tracks){
  if(!track||typeof track!=='object'||Array.isArray(track))return null;
  const t=track as Record<string,unknown>;
  const microphone=t.source==='MICROPHONE'||t.source===2;
  if(!microphone)continue;
  const audio=t.type==='AUDIO'||t.type===0;
  if(!audio||typeof t.sid!=='string'||!sidPattern.test(t.sid))return null;
  if(!sids.includes(t.sid))sids.push(t.sid);
 }
 return sids;
}
export async function muteSignedLearnerMicrophone(env:Env,teacherSubject:string,lessonId:string,
 now=Date.now(),transport:typeof fetch=fetch):Promise<MuteResult>{
 if(!env.DB)return {status:503,code:'DATABASE_UNAVAILABLE'};
 const access=await checkTeacherClassroomAccess(env.DB,teacherSubject,lessonId,now);
 if(!access||!mediaLessonWindow(access,now))
  return {status:404,code:'NOT_FOUND'};
 const authorized=await forwardVerifiedPresence(env,{
  role:'teacher',actorSubject:teacherSubject,lessonId,learnerId:access.learnerId,
 },'heartbeat');
 if(authorized.status!==200)return {status:authorized.status,code:authorized.code};
 const config=validatedLiveKitConfig(env);
 if(!config)return {status:503,code:'LIVEKIT_NOT_CONFIGURED'};
 let learnerOwner:{authSubject:string}|null;
 try{
  learnerOwner=await env.DB.prepare(
   "SELECT account.auth_subject AS authSubject FROM learners learner "+
   "JOIN accounts account ON account.id=learner.account_id "+
   "WHERE learner.id=? AND learner.status='active' AND account.status='active' LIMIT 1"
  ).bind(access.learnerId).first<{authSubject:string}>();
 }catch{return {status:503,code:'DATABASE_UNAVAILABLE'};}
 if(!learnerOwner?.authSubject)return {status:404,code:'NOT_FOUND'};
 try{
  const actor={lessonId,learnerId:access.learnerId,role:'learner' as const,
   actorSubject:learnerOwner.authSubject};
  const {roomName,identity}=await liveKitActorNames(config,actor);
  const admin=await liveKitRoomAdminToken(config,roomName,now);
  const url=liveKitRoomServiceURL(config,'ListParticipants');
  const headers={'authorization':'Bearer '+admin,'content-type':'application/json'};
  const list=await transport(url,{
   method:'POST',redirect:'manual',headers,signal:AbortSignal.timeout(5000),
   body:JSON.stringify({room:roomName}),
  });
  if(!list.ok)return {status:503,code:'LIVEKIT_ROOM_UNAVAILABLE'};
  const payload:unknown=await list.json();
  const sids=microphoneSids(payload,identity);
  if(sids===null)return {status:503,code:'LIVEKIT_ROOM_UNAVAILABLE'};
  // Even if the student is not broadcasting yet, lock future UI unmute until
  // the Sheikh explicitly releases the classroom microphone policy.
  if(!sids.length){
   const lock=await forwardVerifiedMicPolicy(env,{lessonId,learnerId:access.learnerId,
     actorSubject:teacherSubject,role:'teacher'},'lock');
   return lock.status===200?{status:200,code:'NO_LEARNER_MICROPHONE',mutedTracks:0,policy:lock.policy}:
    {status:503,code:'MIC_POLICY_UNAVAILABLE'};
  }
  // Prevent a race where acting Sheikh loses access between listing tracks
  // and muting. Provider confirmation still required for success.
  const stillAllowed=await checkTeacherClassroomAccess(env.DB,teacherSubject,lessonId,Date.now());
  if(!stillAllowed)return {status:404,code:'NOT_FOUND'};
  let muted=0;
  for(const sid of sids){
   const res=await transport(liveKitRoomServiceURL(config,'MutePublishedTrack'),{
    method:'POST',redirect:'manual',headers,signal:AbortSignal.timeout(5000),
    body:JSON.stringify({room:roomName,identity,track_sid:sid,muted:true}),
   });
   if(!res.ok)return {status:503,code:'LIVEKIT_MUTE_UNCONFIRMED'};
   muted++;
  }
  const lock=await forwardVerifiedMicPolicy(env,{lessonId,learnerId:access.learnerId,
    actorSubject:teacherSubject,role:'teacher'},'lock');
  if(lock.status!==200)return {status:503,code:'MIC_POLICY_UNAVAILABLE'};
  return {status:200,code:'LEARNER_MICROPHONE_MUTED',mutedTracks:muted,policy:lock.policy};
 }catch{return {status:503,code:'LIVEKIT_ROOM_UNAVAILABLE'};}
}
