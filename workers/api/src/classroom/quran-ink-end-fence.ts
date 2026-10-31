import type {Env} from '../bindings.ts';

type Result={status:200|404|409|503;code:string};
const id=/^[A-Za-z0-9-]{1,128}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Worker-only lesson End barrier. Caller MUST first verify the authenticated
 * acting Sheikh in D1; the DO itself verifies that Sheikh's room lease.
 * This is never exposed as a public URL.
 */
export async function fenceLessonCumulativeInk(env:Env,lessonId:string,
 learnerId:string,actorSubject:string,operationId:string):Promise<Result>{
 if(!env.LESSON_ROOMS||!env.DB||env.NOOR_CUMULATIVE_INK_ENABLED!=='true')
  return {status:503,code:'QURAN_INK_FENCE_UNAVAILABLE'};
 if(!id.test(lessonId)||!id.test(learnerId)||!id.test(actorSubject)||
  !uuid.test(operationId))
  return {status:404,code:'NOT_FOUND'};
 try{
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(lessonId));
  const response=await stub.fetch(new Request('https://lesson-room.internal/internal/quran-ink-end-fence',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({lessonId,learnerId,actorSubject,operationId}),
  }));
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
   return {status:503,code:'QURAN_INK_FENCE_UNAVAILABLE'};
  const code=(raw as {code?:unknown}).code;
  if(response.status===200&&code==='QURAN_INK_FENCED')
   return {status:200,code};
  if(response.status===409&&code==='QURAN_INK_PENDING')
   return {status:409,code};
  if(response.status===404&&code==='NOT_JOINED')
   return {status:404,code};
  return {status:503,code:'QURAN_INK_FENCE_UNAVAILABLE'};
 }catch{return {status:503,code:'QURAN_INK_FENCE_UNAVAILABLE'};}
}

/** Release only an exact verified End operation that did NOT finish in D1.
 * The DO re-reads live lesson status before unlocking; if the D1 outcome is
 * ambiguous/unavailable, it fails closed and the same Sheikh may retry End.
 */
export async function releaseLessonCumulativeInk(env:Env,lessonId:string,
 learnerId:string,actorSubject:string,operationId:string):Promise<Result>{
 if(!env.LESSON_ROOMS||!env.DB||env.NOOR_CUMULATIVE_INK_ENABLED!=='true')
  return {status:503,code:'QURAN_INK_FENCE_UNAVAILABLE'};
 if(!id.test(lessonId)||!id.test(learnerId)||!id.test(actorSubject)||
  !uuid.test(operationId))return {status:404,code:'NOT_FOUND'};
 try{
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(lessonId));
  const response=await stub.fetch(new Request('https://lesson-room.internal/internal/quran-ink-end-release',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({lessonId,learnerId,actorSubject,operationId}),
  }));
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
   return {status:503,code:'QURAN_INK_FENCE_UNAVAILABLE'};
  const code=(raw as {code?:unknown}).code;
  if(response.status===200&&code==='QURAN_INK_FENCE_RELEASED')
   return {status:200,code};
  if(response.status===409&&code==='QURAN_INK_FENCE_CONFLICT')
   return {status:409,code};
  return {status:503,code:'QURAN_INK_FENCE_UNAVAILABLE'};
 }catch{return {status:503,code:'QURAN_INK_FENCE_UNAVAILABLE'};}
}
