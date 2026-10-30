/** CR-02A: Cloudflare Worker-only LiveKit Cloud join credentials.
 * No LiveKit SDK or secret is imported in browser code. No RoomAdmin/Record,
 * no provider-side recording, data-channel Qur'an events or automatic media.
 */
import type {Env} from '../bindings.ts';
import type {ClassroomAccess} from '../classroom-access.ts';
import {forwardVerifiedPresence} from './presence.ts';

export const MEDIA_TOKEN_TTL_SECONDS=120;
export const MEDIA_EARLY_JOIN_MS=15*60*1000;
export type MediaRole='teacher'|'learner';
export type VerifiedMediaActor=Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:MediaRole;
}>;
export type LiveKitConfig=Readonly<{
 url:string;key:string;secret:string;
}>;
export type MediaTokenResult=
 | Readonly<{status:200;code:'MEDIA_TOKEN_ISSUED';serverUrl:string;participantToken:string;expiresInSeconds:number}>
 | Readonly<{status:400|404|409|503;code:string}>;

export function validatedLiveKitConfig(env:Pick<Env,'LIVEKIT_URL'|'LIVEKIT_API_KEY'|'LIVEKIT_API_SECRET'>):LiveKitConfig|null{
 const url=env.LIVEKIT_URL,key=env.LIVEKIT_API_KEY,secret=env.LIVEKIT_API_SECRET;
 if(typeof url!=='string'||typeof key!=='string'||typeof secret!=='string'||
  !/^[A-Za-z0-9_-]{8,128}$/.test(key)||secret.length<32||secret.length>4096||
  Array.from(secret).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127))return null;
 try{
  const parsed=new URL(url);
  if(parsed.protocol!=='wss:'||!parsed.hostname.endsWith('.livekit.cloud')||
   !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.livekit\.cloud$/.test(parsed.hostname)||
   parsed.port||parsed.username||parsed.password||parsed.search||parsed.hash||
   parsed.pathname!=='/'||(url!==parsed.origin&&url!==parsed.origin+'/'))return null;
  return {url:parsed.origin,key,secret};
 }catch{return null;}
}

/** No scheduled hour-long credential issuance while a class is far in future.
 * A genuinely live class can overrun the instructional/booking clock: this is
 * only token admission control, never an automatic lesson termination policy.
 */
export function mediaLessonWindow(access:ClassroomAccess,now:number):boolean{
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(access.startsAtMs)||
  !Number.isSafeInteger(access.endsAtMs)||access.endsAtMs<=access.startsAtMs)return false;
 if(access.status==='live')return true;
 return access.status==='scheduled'&&
  now>=access.startsAtMs-MEDIA_EARLY_JOIN_MS&&now<=access.endsAtMs;
}
function toBase64Url(bytes:Uint8Array):string{
 let raw='';
 for(const b of bytes)raw+=String.fromCharCode(b);
 return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function encodedJSON(v:unknown):string{
 return toBase64Url(new TextEncoder().encode(JSON.stringify(v)));
}
async function signer(secret:string):Promise<CryptoKey>{
 return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
}
async function mac(key:CryptoKey,data:string):Promise<string>{
 return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(data))));
}
export async function liveKitActorNames(config:LiveKitConfig,actor:VerifiedMediaActor):
 Promise<{roomName:string;identity:string}>{
 const key=await signer(config.secret);
 const roomName='nq-'+(await mac(key,'noor:room:v1:'+actor.lessonId)).slice(0,32);
 const identity='nq-'+(await mac(key,['noor:actor:v1',actor.lessonId,actor.learnerId,
  actor.role,actor.actorSubject].join(':'))).slice(0,32);
 return {roomName,identity};
}
export type IssuedToken=Readonly<{token:string;roomName:string;identity:string;expiresAt:number}>;
/**
 * Separate per-lesson opaque room and participant names: no legal name,
 * phone, actual Better Auth subject, learner ID or student ID in provider logs.
 * Deterministic for reconnects, changed when server secret is rotated.
 */
export async function mintLiveKitToken(config:LiveKitConfig,actor:VerifiedMediaActor,
 nowMs:number):Promise<IssuedToken>{
 if(!Number.isSafeInteger(nowMs)||nowMs<0)throw Error('INVALID_MEDIA_CLOCK');
 const {roomName,identity}=await liveKitActorNames(config,actor);
 const key=await signer(config.secret);
 const nbf=Math.floor(nowMs/1000);
 const exp=nbf+MEDIA_TOKEN_TTL_SECONDS;
 const grant={
  room:roomName,roomJoin:true,
  roomAdmin:false,roomCreate:false,roomList:false,roomRecord:false,
  canPublish:true,canPublishSources:['camera','microphone'],
  canPublishData:false,canSubscribe:true,canUpdateOwnMetadata:false,
 };
 const header=encodedJSON({alg:'HS256',typ:'JWT'});
 const body=encodedJSON({iss:config.key,sub:identity,nbf,iat:nbf,exp,jti:crypto.randomUUID(),video:grant});
 const content=header+'.'+body;
 return {token:content+'.'+await mac(key,content),
  roomName,identity,expiresAt:exp};
}
/** This is the *only* token issuance path; caller must use Better Auth and
 * fresh D1 authorization, then only the signed participant's own DO lease.
 */
export async function createMediaToken(env:Env,actor:VerifiedMediaActor,
 access:ClassroomAccess,now=Date.now()):Promise<MediaTokenResult>{
 if(!mediaLessonWindow(access,now)||access.id!==actor.lessonId||
  access.learnerId!==actor.learnerId||access.role!==actor.role)
  return {status:404,code:'MEDIA_LESSON_UNAVAILABLE'};
 const config=validatedLiveKitConfig(env);
 if(!config)return {status:503,code:'LIVEKIT_NOT_CONFIGURED'};
 // A GET snapshot of the room is NOT sufficient: it could show a different
 // actor's lease. Only a server-validated heartbeat proves this exact actor.
 const presence=await forwardVerifiedPresence(env,actor,'heartbeat');
 if(presence.status!==200)
  return {status:presence.status,code:presence.code};
 if(actor.role==='teacher'&&!presence.presence.teacherPresent||
    actor.role==='learner'&&!presence.presence.learnerPresent)
  return {status:404,code:'MEDIA_LEASE_REQUIRED'};
 try{
  const issued=await mintLiveKitToken(config,actor,now);
  return {status:200,code:'MEDIA_TOKEN_ISSUED',serverUrl:config.url,
   participantToken:issued.token,expiresInSeconds:MEDIA_TOKEN_TTL_SECONDS};
 }catch{
  return {status:503,code:'LIVEKIT_TOKEN_UNAVAILABLE'};
 }
}
