import type {CoreDatabase,Env} from '../bindings.ts';
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

/** The authoritative page→Ayah map is the separately audited 6,236 row D1
 * Quran anchor import, not a Worker-to-Worker HTTP fetch that can 503 or drift.
 * Verify the pinned Hafs manifest and exact row before accepting a change.
 * Fail closed when D1 is unavailable. The browser still renders exact polygons.
 */
export const QURAN_ANCHOR_EDITION='hafs-kfqc:v1.1.1' as const;
export const QURAN_ANCHOR_MANIFEST='864c5474872876b3db8a328d8c74781be83c004a7cdb168ffb4b7eb57477edd2' as const;
export async function verifyPublishedVerse(db:CoreDatabase,page:number,
 verse:VerseSelection):Promise<boolean|null>{
 if(!Number.isInteger(page)||page<1||page>604||!validVerse(verse))return false;
 try{
  const result=await db.prepare(`SELECT anchor.page AS page
   FROM quran_ayah_anchors anchor
   JOIN quran_editions edition ON edition.id=anchor.edition_id
   WHERE edition.id=? AND edition.riwayah='hafs' AND edition.page_count=604
    AND edition.manifest_sha256=? AND anchor.surah=? AND anchor.ayah=?
   LIMIT 1`)
   .bind(QURAN_ANCHOR_EDITION,QURAN_ANCHOR_MANIFEST,verse.surah,verse.ayah)
   .first<{page:number}>();
  return !!result&&result.page===page;
 }catch{return null;}
}
export async function forwardVerifiedPage(env:Env,verified:Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher'|'learner';
}>,action:PageAction):Promise<PageOutcome>{
 if(!env.LESSON_ROOMS)return {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'};
 if(action.action==='set'&&action.verse){
  // Use pinned, server-verified D1 anchors. Never trust browser page arithmetic.
  if(!env.DB)return {status:503,code:'QURAN_VERSE_METADATA_UNAVAILABLE'};
  const hasVerse=await verifyPublishedVerse(env.DB,action.page,action.verse);
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
