import type {Env} from '../bindings.ts';

/** The browser never sends an actor ID, room ID or role into a privileged DO.
 * Verified Better Auth + D1 access are resolved first in auth/routes.ts. */
export type VerifiedRealtimeActor=Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher'|'learner';
}>;
export type RealtimeHint=Readonly<{
 type:'quran-page'|'quran-ink';page:number;revision:number;
}>;
const validId=/^[A-Za-z0-9-]{1,128}$/;
export function validVerifiedRealtimeActor(value:unknown):value is VerifiedRealtimeActor{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const r=value as Record<string,unknown>;
 return Object.keys(r).length===4&&
  ['lessonId','learnerId','actorSubject'].every(k=>
   typeof r[k]==='string'&&validId.test(r[k] as string))&&
  (r.role==='teacher'||r.role==='learner');
}
export function validRealtimeHint(value:unknown):value is RealtimeHint{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const r=value as Record<string,unknown>;
 return Object.keys(r).length===3&&
  (r.type==='quran-page'||r.type==='quran-ink')&&
  Number.isInteger(r.page)&&Number(r.page)>=1&&Number(r.page)<=604&&
  Number.isSafeInteger(r.revision)&&Number(r.revision)>=0;
}
export async function openVerifiedRealtime(
 env:Env,actor:VerifiedRealtimeActor,request:Request
):Promise<Response>{
 // Browsers only: a valid signed session is checked at the outer route.
 // This origin check also prevents cross-origin WebSocket cookie hijacking.
 const origin=new URL(request.url).origin;
 if(request.method!=='GET'||request.headers.get('Origin')!==origin)
  return Response.json({code:'BAD_ORIGIN'},{status:403});
 if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')
  return Response.json({code:'UPGRADE_REQUIRED'},{status:426});
 if(!validVerifiedRealtimeActor(actor))
  return Response.json({code:'INVALID_REALTIME_ACTOR'},{status:400});
 if(!env.LESSON_ROOMS)
  return Response.json({code:'CLASSROOM_ROOM_NOT_CONFIGURED'},{status:503});
 try{
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(actor.lessonId));
  return await stub.fetch(new Request('https://lesson-room.internal/internal/realtime',{
   method:'GET',headers:{
    Upgrade:'websocket',
    'x-noor-lesson':actor.lessonId,
    'x-noor-learner':actor.learnerId,
    'x-noor-subject':actor.actorSubject,
    'x-noor-role':actor.role,
   }
  }));
 }catch{
  return Response.json({code:'CLASSROOM_REALTIME_UNAVAILABLE'},{status:503});
 }
}
