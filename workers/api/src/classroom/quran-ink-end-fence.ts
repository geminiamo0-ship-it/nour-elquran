import type {Env} from '../bindings.ts';

type Result={status:200|404|409|503;code:string};
const id=/^[A-Za-z0-9-]{1,128}$/;
/** Worker-only lesson End barrier. Caller MUST first verify the authenticated
 * acting Sheikh in D1; the DO itself verifies that Sheikh's room lease.
 * This is never exposed as a public URL.
 */
export async function fenceLessonCumulativeInk(env:Env,lessonId:string,
 learnerId:string,actorSubject:string):Promise<Result>{
 if(!env.LESSON_ROOMS||!env.DB||env.NOOR_CUMULATIVE_INK_ENABLED!=='true')
  return {status:503,code:'QURAN_INK_FENCE_UNAVAILABLE'};
 if(!id.test(lessonId)||!id.test(learnerId)||!id.test(actorSubject))
  return {status:404,code:'NOT_FOUND'};
 try{
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(lessonId));
  const response=await stub.fetch(new Request('https://lesson-room.internal/internal/quran-ink-end-fence',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({lessonId,learnerId,actorSubject}),
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
