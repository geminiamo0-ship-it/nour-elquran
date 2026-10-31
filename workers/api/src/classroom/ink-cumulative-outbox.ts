import {parseQuranLedgerCommand,type QuranLedgerCommand} from '../learner-quran-ledger.ts';
import type {InkPage,VerifiedInkCommand,InkStroke} from './quran-ink.ts';

/** ADR 0009 / #252: pure, server-side bridge contract. A DO must transactionally
 * enqueue this record with the room stroke BEFORE acknowledging the room write.
 * No public route or background sender is enabled by this module alone.
 */
export type PendingQuranInk=Readonly<{
 operationId:string;learnerId:string;lessonId:string;
 actorSubject:string;actorRole:'teacher'|'learner';
 command:QuranLedgerCommand;acceptedAtMs:number;
}>;
export const MAX_PENDING_QURAN_INK=64;
const allowed=/^[a-zA-Z0-9-]{1,128}$/;
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
/** Identical source operation/stroke produces identical stable UUID after retry,
 * without relying on time or a hidden random seed.
 */
async function stableIds(lessonId:string,learnerId:string,strokeId:string,
 actorSubject:string,requestId:string):Promise<{itemId:string;operationId:string}>{
 const itemHash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder()
  .encode('noor:ink-item:v1|'+learnerId+'|'+lessonId+'|'+strokeId)));
 const opHash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder()
  .encode('noor:ink-operation:v1|'+learnerId+'|'+lessonId+'|'+actorSubject+'|'+requestId)));
 // Force the version and variant bits so the strictly validated canonical
 // ledger treats the deterministic digest as a valid v4-format operation key.
 const operationId=opHash.slice(0,8)+'-'+opHash.slice(8,12)+'-4'+opHash.slice(13,16)+
  '-8'+opHash.slice(17,20)+'-'+opHash.slice(20,32);
 return {itemId:'ink-'+itemHash.slice(0,40),operationId};
}
function originalStroke(before:InkPage,id:string){
 return before.records.find(record=>record.stroke.id===id&&record.visible);
}
/** Only call AFTER the DO has parsed signed Worker command and confirmed active
 * actor lease, current shared page and expected revision.
 * A hide reuses the original stroke's kind, page and canonical item identity;
 * moderation does not recast the Sheikh as the creator of the original mark.
 */
export async function prepareCumulativeInkDelivery(cmd:VerifiedInkCommand,
 before:InkPage,acceptedAtMs:number):Promise<PendingQuranInk|null>{
 if(cmd.action!=='add'&&cmd.action!=='hide')return null;
 if(!allowed.test(cmd.lessonId)||!allowed.test(cmd.learnerId)||
  !allowed.test(cmd.actorSubject)||cmd.page!==before.page||
  !Number.isSafeInteger(acceptedAtMs)||acceptedAtMs<0||!cmd.requestId)return null;
 const stroke:InkStroke|undefined=cmd.action==='add'?cmd.stroke:
  originalStroke(before,cmd.strokeId??'')?.stroke;
 if(!stroke||stroke.page!==cmd.page)return null;
 const ids=await stableIds(cmd.lessonId,cmd.learnerId,stroke.id,cmd.actorSubject,cmd.requestId);
 const record:QuranLedgerCommand={
  operationId:ids.operationId,itemId:ids.itemId,
  action:cmd.action==='add'?'put':'hide',
  kind:stroke.kind,originType:'lesson',originId:cmd.lessonId,
  page:cmd.page,surah:null,ayah:null,wordIndex:null,
  expectedRevision:cmd.action==='add'?0:1,
  payload:cmd.action==='add'?
   {color:stroke.color,width:stroke.width,points:stroke.points.map(p=>({x:p.x,y:p.y}))}:{}
 };
 if(!parseQuranLedgerCommand(record))return null;
 return {operationId:ids.operationId,learnerId:cmd.learnerId,
  lessonId:cmd.lessonId,actorSubject:cmd.actorSubject,actorRole:cmd.role,
  command:record,acceptedAtMs};
}
export type EnqueueQuranResult=
 Readonly<{code:'QUEUED'|'REPLAY'|'CONFLICT'|'FULL';items:readonly PendingQuranInk[]}>;
/** Bounded, in-order DO outbox operation. Do NOT evict an unacknowledged
 * entry, and never treat a conflicting replay of an operation ID as success.
 */
export function queueCumulativeInk(items:readonly PendingQuranInk[],
 event:PendingQuranInk):EnqueueQuranResult{
 const previous=items.find(x=>x.operationId===event.operationId);
 if(previous)return {code:JSON.stringify(previous)===JSON.stringify(event)?'REPLAY':'CONFLICT',items};
 if(items.length>=MAX_PENDING_QURAN_INK)return {code:'FULL',items};
 return {code:'QUEUED',items:[...items,event]};
}
