import type {Env} from '../bindings.ts';
import type {VerifiedPageCommand,SharedPage} from './quran-page.ts';
import {LIVE_QURAN_EDITION,LIVE_QURAN_PAGE_COUNT} from './quran-page.ts';

export type PageAction=Readonly<
 {action:'snapshot'}|
 {action:'set';page:number;expectedRevision:number;requestId:string}
>;
export function parsePageAction(value:unknown,role:'teacher'|'learner'):PageAction|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(v.action==='snapshot'&&Object.keys(v).length===1)return {action:'snapshot'};
 if(role!=='teacher'||v.action!=='set'||Object.keys(v).length!==4||
  !['page','expectedRevision','requestId'].every(k=>Object.hasOwn(v,k))||
  !Number.isInteger(v.page)||Number(v.page)<1||Number(v.page)>LIVE_QURAN_PAGE_COUNT||
  !Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0||
  typeof v.requestId!=='string'||!/^[A-Za-z0-9-]{8,128}$/.test(v.requestId))return null;
 return {action:'set',page:v.page as number,expectedRevision:v.expectedRevision as number,
  requestId:v.requestId as string};
}
export type PageOutcome=Readonly<{
 status:200|400|404|409|503;code:string;quran?:SharedPage;
}>;
export async function forwardVerifiedPage(env:Env,verified:Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher'|'learner';
}>,action:PageAction):Promise<PageOutcome>{
 if(!env.LESSON_ROOMS)return {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'};
 const command:VerifiedPageCommand={...verified,...action};
 try{
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(verified.lessonId));
  const res=await stub.fetch(new Request('https://lesson-room.internal/internal/quran-page',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(command)
  }));
  const data:unknown=await res.json();
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('INVALID');
  const value=data as Record<string,unknown>;
  if(!res.ok){
   if(res.status===404&&value.code==='NOT_JOINED')return {status:404,code:'NOT_JOINED'};
   if(res.status===409&&value.code==='QURAN_PAGE_CONFLICT'&&validPage(value.quran))
    return {status:409,code:'QURAN_PAGE_CONFLICT',quran:value.quran};
   return {status:503,code:'CLASSROOM_QURAN_UNAVAILABLE'};
  }
  if(!['QURAN_PAGE_SNAPSHOT','QURAN_PAGE_SET','QURAN_PAGE_REPLAY'].includes(String(value.code))||
     !validPage(value.quran))
   throw Error('INVALID');
  return {status:200,code:String(value.code),quran:value.quran};
 }catch{return {status:503,code:'CLASSROOM_QURAN_UNAVAILABLE'};}
}
function validPage(raw:unknown):raw is SharedPage{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const r=raw as Record<string,unknown>;
 return Object.keys(r).length===3&&r.edition===LIVE_QURAN_EDITION&&
  Number.isInteger(r.page)&&Number(r.page)>=1&&Number(r.page)<=LIVE_QURAN_PAGE_COUNT&&
  Number.isSafeInteger(r.revision)&&Number(r.revision)>=0;
}
