/** DEV ONLY. A scoped provider authentication check, never media or room creation. */
import type {Env} from '../bindings.ts';
import {liveKitActorNames,validatedLiveKitConfig,type VerifiedMediaActor} from './livekit-token.ts';

type Check=Readonly<{status:200|503;code:'LIVEKIT_PROVIDER_REACHABLE'|
 'LIVEKIT_NOT_CONFIGURED'|'LIVEKIT_PROVIDER_AUTH_REJECTED'|'LIVEKIT_PROVIDER_UNAVAILABLE'|
 'LIVEKIT_PROVIDER_BAD_REQUEST'|'LIVEKIT_PROVIDER_RATE_LIMITED'|
 'LIVEKIT_PROVIDER_HTTP_4XX'|'LIVEKIT_PROVIDER_UPSTREAM_5XX'|
 'LIVEKIT_PROVIDER_BAD_RESPONSE'|'LIVEKIT_PROVIDER_NETWORK_ERROR'}>;
function base64url(value:unknown):string{
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 let raw='';for(const b of bytes)raw+=String.fromCharCode(b);
 return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function checkLiveKitProvider(
 env:Env,actor:VerifiedMediaActor,now=Date.now(),transport:typeof fetch=fetch
):Promise<Check>{
 if(env.NOOR_ENVIRONMENT!=='staging'||env.NOOR_DEV_OPEN!=='true'||actor.role!=='teacher'||
  !Number.isSafeInteger(now)||now<0)
  return {status:503,code:'LIVEKIT_PROVIDER_UNAVAILABLE'};
 const config=validatedLiveKitConfig(env);
 if(!config)return {status:503,code:'LIVEKIT_NOT_CONFIGURED'};
 try{
  const {roomName}=await liveKitActorNames(config,actor);
  const time=Math.floor(now/1000);
  const head=base64url({alg:'HS256',typ:'JWT'});
  const body=base64url({iss:config.key,sub:'noor-dev-provider-check',
    nbf:time,iat:time,exp:time+30,jti:crypto.randomUUID(),
    video:{roomList:true,roomJoin:false,roomAdmin:false,
     roomCreate:false,roomRecord:false}});
  const signed=head+'.'+body;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(signed)));
  let sig='';for(const b of bytes)sig+=String.fromCharCode(b);
  const token=signed+'.'+btoa(sig).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const response=await transport('https://'+new URL(config.url).hostname+
   '/twirp/livekit.RoomService/ListRooms',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({names:[roomName]}),
  });
  // Only fixed status categories are returned, never provider bodies, tokens or URLs.
  if(response.status===401||response.status===403)
   return {status:503,code:'LIVEKIT_PROVIDER_AUTH_REJECTED'};
  if(response.status===400)return {status:503,code:'LIVEKIT_PROVIDER_BAD_REQUEST'};
  if(response.status===429)return {status:503,code:'LIVEKIT_PROVIDER_RATE_LIMITED'};
  if(response.status>=500)return {status:503,code:'LIVEKIT_PROVIDER_UPSTREAM_5XX'};
  if(!response.ok)return {status:503,code:'LIVEKIT_PROVIDER_HTTP_4XX'};
  if(!response.headers.get('content-type')?.includes('application/json'))
   return {status:503,code:'LIVEKIT_PROVIDER_BAD_RESPONSE'};
  let result:unknown;
  try{result=await response.json();}
  catch{return {status:503,code:'LIVEKIT_PROVIDER_BAD_RESPONSE'};}
  if(!result||typeof result!=='object'||Array.isArray(result)||
   ('rooms' in result&&!Array.isArray((result as {rooms:unknown}).rooms)))
   return {status:503,code:'LIVEKIT_PROVIDER_BAD_RESPONSE'};
  return {status:200,code:'LIVEKIT_PROVIDER_REACHABLE'};
 }catch{return {status:503,code:'LIVEKIT_PROVIDER_NETWORK_ERROR'};}
}
