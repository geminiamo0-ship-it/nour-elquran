/** The ONLY browser-side LiveKit API contract. No LiveKit API key or secret. */
export type RoomIdentity=Readonly<{
  role:'teacher'|'learner';lessonId:string;learnerId?:string;
}>;
export type JoinTicket=Readonly<{
  serverUrl:string;participantToken:string;expiresInSeconds:120;
}>;
export type JoinFailure='UNAVAILABLE'|'UNAUTHORIZED'|'NETWORK'|'INVALID_RESPONSE';
const identifier=/^[a-zA-Z0-9-]{1,128}$/;
export function mediaTokenPath(identity:RoomIdentity):string {
  if(!identifier.test(identity.lessonId))throw Error('INVALID_ROOM_IDENTITY');
  if(identity.role==='teacher'&&!identity.learnerId)
    return '/v1/teacher/lessons/'+encodeURIComponent(identity.lessonId)+'/media-token';
  if(identity.role==='learner'&&identity.learnerId&&identifier.test(identity.learnerId))
    return '/v1/me/learners/'+encodeURIComponent(identity.learnerId)+
      '/lessons/'+encodeURIComponent(identity.lessonId)+'/media-token';
  throw Error('INVALID_ROOM_IDENTITY');
}
export class JoinError extends Error{
  constructor(readonly code:JoinFailure){super(code);}
}
export function parseJoinTicket(payload:unknown):JoinTicket{
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
    throw new JoinError('INVALID_RESPONSE');
  const p=payload as Record<string,unknown>;
  if(p.code!=='MEDIA_TOKEN_ISSUED'||typeof p.serverUrl!=='string'||
    typeof p.participantToken!=='string'||p.expiresInSeconds!==120||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(p.participantToken))
    throw new JoinError('INVALID_RESPONSE');
  let parsed:URL;
  try{parsed=new URL(p.serverUrl);}catch{throw new JoinError('INVALID_RESPONSE');}
  if(parsed.protocol!=='wss:'||!parsed.hostname.endsWith('.livekit.cloud')||
     !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.livekit\.cloud$/.test(parsed.hostname)||
     parsed.username||parsed.password||parsed.port||parsed.search||parsed.hash||
     parsed.pathname!=='/'||p.serverUrl!==parsed.origin)
    throw new JoinError('INVALID_RESPONSE');
  return {serverUrl:p.serverUrl,participantToken:p.participantToken,
    expiresInSeconds:120};
}
export async function requestMediaTicket(identity:RoomIdentity,signal?:AbortSignal):
 Promise<JoinTicket>{
  let res:Response;
  try{res=await fetch(mediaTokenPath(identity),{
    method:'POST',headers:{'content-type':'application/json'},body:'{}',
    credentials:'same-origin',cache:'no-store',redirect:'error',signal,
  });}catch{throw new JoinError('NETWORK');}
  if(!res.ok){
    if(res.status===503)return Promise.reject(new JoinError('UNAVAILABLE'));
    if(res.status===401||res.status===403||res.status===404||res.status===409)
      throw new JoinError('UNAUTHORIZED');
    throw new JoinError('INVALID_RESPONSE');
  }
  let payload:unknown;
  try{payload=await res.json();}catch{throw new JoinError('INVALID_RESPONSE');}
  return parseJoinTicket(payload);
}
