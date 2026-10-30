/** LiveKit Cloud server-side, room-scoped participant eviction ONLY.
 * No public endpoint; use only from the lesson DO's durable outbox.
 * Cannot mint a client RoomAdmin token or choose arbitrary browser room IDs.
 */
import {liveKitActorNames,validatedLiveKitConfig,
 type LiveKitConfig,type VerifiedMediaActor} from './livekit-token.ts';
import type {Env} from '../bindings.ts';

export type EvictionResult='removed'|'retry'|'unconfigured';
function base64url(bytes:Uint8Array):string{
 let v='';for(const b of bytes)v+=String.fromCharCode(b);
 return btoa(v).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function liveKitRoomAdminToken(config:LiveKitConfig,room:string,now:number):Promise<string>{
 const epoch=Math.floor(now/1000);
 const header=base64url(new TextEncoder().encode(JSON.stringify({alg:'HS256',typ:'JWT'})));
 const claims=base64url(new TextEncoder().encode(JSON.stringify({
  iss:config.key,sub:'noor-classroom-evictor',nbf:epoch,iat:epoch,exp:epoch+60,
  jti:crypto.randomUUID(),video:{room,roomAdmin:true,roomJoin:false,
   roomCreate:false,roomList:false,roomRecord:false},
 })));
 const body=header+'.'+claims;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=base64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(body))));
 return body+'.'+signature;
}
export function liveKitRoomServiceURL(config:LiveKitConfig,method:'RemoveParticipant'|'ListParticipants'|'MutePublishedTrack'='RemoveParticipant'):string{
 // validatedLiveKitConfig is the sole source of a LiveKitConfig from Env.
 const u=new URL(config.url);
 if(u.protocol!=='wss:'||!u.hostname.endsWith('.livekit.cloud')||
   !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.livekit\.cloud$/.test(u.hostname)||
   u.port||u.username||u.password||u.search||u.hash||u.pathname!=='/')
  throw new Error('INVALID_LIVEKIT_ROOM_SERVICE_HOST');
 return 'https://'+u.hostname+'/twirp/livekit.RoomService/'+method;
}
export async function evictVerifiedLiveKitActor(env:Env,actor:VerifiedMediaActor,
 now=Date.now(),transport:typeof fetch=fetch):Promise<EvictionResult>{
 const config=validatedLiveKitConfig(env);
 if(!config)return 'unconfigured';
 // These two IDs are HMAC-derived from the same inputs as the signed join JWT.
 // Neither can be injected by a client, outbox body or user-supplied URL.
 try{
  const {roomName,identity}=await liveKitActorNames(config,actor);
  const token=await liveKitRoomAdminToken(config,roomName,now);
  const url=liveKitRoomServiceURL(config);
  const res=await transport(url,{method:'POST',redirect:'manual',
   headers:{'authorization':'Bearer '+token,'content-type':'application/json'},
   signal:AbortSignal.timeout(5000),
   body:JSON.stringify({room:roomName,identity,
    // LiveKit Cloud explicit cutoff closes the recent refreshed-token gap.
    // The value must be close to current provider wall-clock time.
    revoke_token_ts:Math.floor(now/1000)}),
  });
  // Do not treat unverified 404/5xx/error bodies as successful token revocation:
  // LiveKit says explicit revoke_token_ts normally suppresses absent-participant
  // errors. Any other response leaves the outbox pending for reconciliation.
  return res.ok?'removed':'retry';
 }catch{return 'retry';}
}
