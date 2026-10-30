import type {Env} from '../bindings.ts';
import type {VerifiedPageCommand,SharedPage,VerseSelection} from './quran-page.ts';
import {LIVE_QURAN_EDITION,LIVE_QURAN_PAGE_COUNT,validVerse} from './quran-page.ts';

export type PageAction=Readonly<
 {action:'snapshot'}|
 {action:'set';page:number;expectedRevision:number;requestId:string;verse?:VerseSelection}
>;
export function parsePageAction(value:unknown,role:'teacher'|'learner'):PageAction|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>,count=Object.keys(v).length;
 if(v.action==='snapshot'&&count===1)return {action:'snapshot'};
 if(role!=='teacher'||v.action!=='set'||![4,5].includes(count)||
  !['page','expectedRevision','requestId'].every(k=>Object.hasOwn(v,k))||
  (count===5&&(!Object.hasOwn(v,'verse')||!validVerse(v.verse)))||
  !Number.isInteger(v.page)||Number(v.page)<1||Number(v.page)>LIVE_QURAN_PAGE_COUNT||
  !Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0||
  typeof v.requestId!=='string'||!/^[A-Za-z0-9-]{8,128}$/.test(v.requestId))return null;
 return {action:'set',page:v.page as number,expectedRevision:v.expectedRevision as number,
  requestId:v.requestId as string,
  ...(count===5?{verse:v.verse as VerseSelection}:{})};
}
export type PageOutcome=Readonly<{
 status:200|400|404|409|503;code:string;quran?:SharedPage;
}>;

/** The exact same immutable KFQC page sidecar as the visible Quran. The API
 * rejects forged Ayah-to-page mappings; no estimated verse arithmetic.
 */
export async function verifyPublishedVerse(page:number,verse:VerseSelection,
 transport:typeof fetch=fetch):Promise<boolean|null>{
 if(!Number.isInteger(page)||page<1||page>604||!validVerse(verse))return false;
 const name=String(page).padStart(3,'0');
 const url='https://noor-quran-assets.geminiamo0.workers.dev/quran/hafs/v1.1.1/pages/'+name+'.json';
 try{
  const response=await transport(url,{method:'GET',redirect:'error',
   signal:AbortSignal.timeout(4500)});
  if(!response.ok||Number(response.headers.get('content-length'))>1500000)return null;
  const text=await response.text();
  if(text.length>1500000)return null;
  const data:unknown=JSON.parse(text);
  let visited=0;
  const scan=(value:unknown):boolean=>{
   if(++visited>30000||!value||typeof value!=='object')return false;
   if(Array.isArray(value))return value.some(scan);
   const obj=value as Record<string,unknown>;
   if(obj.surahNumber===verse.surah&&obj.ayahNumber===verse.ayah&&
    typeof obj.polygon==='string'&&obj.polygon.length>2)return true;
   return Object.values(obj).some(scan);
  };
  return scan(data);
 }catch{return null;}
}
export async function forwardVerifiedPage(env:Env,verified:Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher'|'learner';
}>,action:PageAction,transport:typeof fetch=fetch):Promise<PageOutcome>{
 if(!env.LESSON_ROOMS)return {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'};
 if(action.action==='set'&&action.verse){
  // Source must confirm this Ayah is genuinely on this page. On network
  // failure, fail closed without falsely claiming a successful selection.
  const hasVerse=await verifyPublishedVerse(action.page,action.verse,transport);
  if(hasVerse===false)return {status:400,code:'QURAN_VERSE_PAGE_MISMATCH'};
  if(hasVerse===null)return {status:503,code:'QURAN_VERSE_METADATA_UNAVAILABLE'};
 }
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
 const r=raw as Record<string,unknown>,count=Object.keys(r).length;
 return (count===3||(count===4&&validVerse(r.verse)))&&r.edition===LIVE_QURAN_EDITION&&
  Number.isInteger(r.page)&&Number(r.page)>=1&&Number(r.page)<=LIVE_QURAN_PAGE_COUNT&&
  Number.isSafeInteger(r.revision)&&Number(r.revision)>=0;
}
