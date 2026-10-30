/** Wake a lesson DO after an authorized D1 staff write, without trusting
 * any provider identity supplied by browser. The DO's durable alarm/outbox
 * remains responsible for retrying failed provider evictions.
 */
import type {Env} from '../bindings.ts';
import {MEDIA_EARLY_JOIN_MS} from './livekit-token.ts';
const valid=/^[A-Za-z0-9-]{1,128}$/;
export type WakeResult='sent'|'unavailable';
export async function wakeLessonMediaReconciliation(env:Env,lessonId:string):Promise<WakeResult>{
 if(!valid.test(lessonId)||!env.LESSON_ROOMS)return 'unavailable';
 try{
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(lessonId));
  const res=await stub.fetch(new Request('https://lesson-room.internal/internal/reconcile-media',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({lessonId}),
  }));
  return res.ok?'sent':'unavailable';
 }catch{return 'unavailable';}
}
/** Acting teacher ID comes from a successful roles.manage D1 event, not user
 * supplied headers. D1's single-live-lesson trigger limits live concurrency.
 */
export async function wakeActingTeacherMedia(env:Env,teacherId:string,now=Date.now()):
 Promise<WakeResult>{
 if(!valid.test(teacherId)||!Number.isSafeInteger(now)||!env.DB)return 'unavailable';
 try{
  const rows=await env.DB.prepare(
   "SELECT id FROM lessons WHERE actual_teacher_id=?"+
   " AND (status='live' OR (status='scheduled'"+
   " AND starts_at_ms<=? AND ends_at_ms>=?))"+
   " ORDER BY starts_at_ms DESC LIMIT 64"
  ).bind(teacherId,now+MEDIA_EARLY_JOIN_MS,now).all<{id:string}>();
  let outcome:WakeResult='sent';
  for(const row of rows.results){
   if(await wakeLessonMediaReconciliation(env,row.id)==='unavailable')
    outcome='unavailable';
  }
  return outcome;
 }catch{return 'unavailable';}
}
