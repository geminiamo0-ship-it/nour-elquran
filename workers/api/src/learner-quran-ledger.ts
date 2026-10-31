import type {CoreDatabase} from './bindings.ts';
import {readPrivateMushaf,PRIVATE_EDITION} from './private-mushaf.ts';

/** ADR 0009 / #251: server-only typed staging adapter. The public Worker does
 * NOT yet expose this surface: a trusted route must derive actor credentials
 * from Better Auth and verify live DO presence before allowing lesson writes.
 */
export type QuranLedgerRole='learner'|'teacher';
export type QuranOrigin='self_study'|'lesson'|'assignment';
export type QuranMarkKind='pen'|'marker'|'note'|'highlight';
export type QuranLedgerCommand=Readonly<{
 operationId:string;itemId:string;action:'put'|'hide';kind:QuranMarkKind;
 originType:QuranOrigin;originId:string|null;page:number;
 surah:number|null;ayah:number|null;wordIndex:number|null;
 expectedRevision:number;payload:Record<string,unknown>;
}>;
export type QuranLedgerCurrent=Readonly<{
 itemId:string;page:number;kind:QuranMarkKind;surah:number|null;
 ayah:number|null;wordIndex:number|null;visible:boolean;revision:number;
 audience:'private'|'shared';authorRole:QuranLedgerRole;authorSubject:string;
 originType:QuranOrigin;originId:string|null;
 payload:Record<string,unknown>;
}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const itemId=/^[A-Za-z0-9_.:-]{8,128}$/;
const hex=/^#[0-9a-fA-F]{6}$/;
const isObject=(v:unknown):v is Record<string,unknown> =>
 !!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(x:Record<string,unknown>,keys:readonly string[]) =>
 Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k));
const page=(x:unknown):x is number=>Number.isInteger(x)&&Number(x)>=1&&Number(x)<=604;
function validPayload(kind:QuranMarkKind,p:Record<string,unknown>):boolean{
 if(typeof p.color!=='string'||!hex.test(p.color))return false;
 if(kind==='note')return exact(p,['color','text'])&&
  typeof p.text==='string'&&p.text.trim().length>0&&p.text.length<=500;
 if(kind==='highlight')return exact(p,['color']);
 if(!exact(p,['color','width','points'])||
   typeof p.width!=='number'||!Number.isFinite(p.width)||
   p.width<1||p.width>60||!Array.isArray(p.points)||
   p.points.length<2||p.points.length>2500)return false;
 return p.points.every((v:unknown)=>isObject(v)&&exact(v,['x','y'])&&
  typeof v.x==='number'&&Number.isFinite(v.x)&&v.x>=0&&v.x<=1000&&
  typeof v.y==='number'&&Number.isFinite(v.y)&&v.y>=0&&v.y<=1594);
}
const commandKeys=['operationId','itemId','action','kind','originType','originId',
 'page','surah','ayah','wordIndex','expectedRevision','payload'] as const;
/** Reject role, actor, learner and edition supplied by a browser. */
export function parseQuranLedgerCommand(raw:unknown):QuranLedgerCommand|null{
 if(!isObject(raw)||!exact(raw,commandKeys)||
  typeof raw.operationId!=='string'||!uuid.test(raw.operationId)||
  typeof raw.itemId!=='string'||!itemId.test(raw.itemId)||
  (raw.action!=='put'&&raw.action!=='hide')||
  !['pen','marker','note','highlight'].includes(String(raw.kind))||
  !['self_study','lesson','assignment'].includes(String(raw.originType))||
  !page(raw.page)||!Number.isSafeInteger(raw.expectedRevision)||Number(raw.expectedRevision)<0||
  !isObject(raw.payload))return null;
 const kind=raw.kind as QuranMarkKind,origin=raw.originType as QuranOrigin;
 if((origin==='self_study'&&raw.originId!==null)||
  (origin!=='self_study'&&(typeof raw.originId!=='string'||!itemId.test(raw.originId)))||
  (kind==='note'||kind==='highlight'
   ?!(Number.isInteger(raw.surah)&&Number(raw.surah)>=1&&Number(raw.surah)<=114&&
      Number.isInteger(raw.ayah)&&Number(raw.ayah)>=1&&
      (raw.wordIndex===null||(Number.isInteger(raw.wordIndex)&&Number(raw.wordIndex)>=1)))
   :!(raw.surah===null&&raw.ayah===null&&raw.wordIndex===null)))return null;
 if(raw.action==='hide'&&(!exact(raw.payload,[])||Number(raw.expectedRevision)===0))return null;
 if(raw.action==='put'&&!validPayload(kind,raw.payload))return null;
 return raw as QuranLedgerCommand;
}
export type VerifiedQuranActor=Readonly<{subject:string;role:QuranLedgerRole}>;
const INSERT=`INSERT INTO learner_quran_events(
 id,learner_id,operation_id,item_id,actor_subject,actor_role,origin_type,origin_id,
 audience,action,edition_id,page,surah,ayah,word_index,kind,expected_revision,
 payload_json,at_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
type Prior={actor_subject:string;actor_role:QuranLedgerRole;action:string;
 origin_type:QuranOrigin;origin_id:string|null;item_id:string;kind:string;
 page:number;surah:number|null;ayah:number|null;word_index:number|null;
 expected_revision:number;payload_json:string};
const PRIOR=`SELECT actor_subject,actor_role,action,origin_type,origin_id,item_id,kind,
 page,surah,ayah,word_index,expected_revision,payload_json FROM learner_quran_events
 WHERE learner_id=? AND operation_id=?`;
type Row={item_id:string;page:number;kind:QuranMarkKind;surah:number|null;
 ayah:number|null;word_index:number|null;visible:number;revision:number;
 audience:'private'|'shared';author_role:QuranLedgerRole;author_subject:string;
 origin_type:QuranOrigin;origin_id:string|null;payload_json:string};
function asCurrent(row:Row):QuranLedgerCurrent{
 return {itemId:row.item_id,page:row.page,kind:row.kind,surah:row.surah,
  ayah:row.ayah,wordIndex:row.word_index,visible:row.visible===1,revision:row.revision,
  audience:row.audience,authorRole:row.author_role,authorSubject:row.author_subject,
  originType:row.origin_type,originId:row.origin_id,
  payload:JSON.parse(row.payload_json) as Record<string,unknown>};
}
function same(p:Prior,a:VerifiedQuranActor,c:QuranLedgerCommand,body:string){
 return p.actor_subject===a.subject&&p.actor_role===a.role&&
  p.action===c.action&&p.item_id===c.itemId&&p.kind===c.kind&&
  p.origin_type===c.originType&&p.origin_id===c.originId&&p.page===c.page&&
  p.surah===c.surah&&p.ayah===c.ayah&&p.word_index===c.wordIndex&&
  p.expected_revision===c.expectedRevision&&p.payload_json===body;
}
const ROW=`SELECT item_id,page,kind,surah,ayah,word_index,visible,revision,audience,
 author_role,author_subject,origin_type,origin_id,payload_json
 FROM learner_quran_current WHERE learner_id=? AND item_id=?`;
/** The actor is trusted *only* when derived from authenticated Worker session.
 * Current permission is rechecked even for an old operation replay, so a
 * revoked teacher cannot use a saved idempotency key to regain access.
 */
async function authorized(db:CoreDatabase,a:VerifiedQuranActor,learnerId:string,
 c:QuranLedgerCommand,now:number):Promise<boolean>{
 if(a.role==='learner'){
  const owner=await db.prepare(`SELECT 1 AS allowed FROM learners l
   JOIN accounts account ON account.id=l.account_id
   WHERE l.id=? AND l.status='active' AND account.status='active'
    AND account.auth_subject=?`).bind(learnerId,a.subject).first<{allowed:number}>();
  if(!owner)return false;
  if(c.originType==='assignment')return false;
  if(c.originType==='lesson'){
   const live=await db.prepare(`SELECT 1 AS allowed FROM lessons
    WHERE id=? AND learner_id=? AND status='live'`).bind(c.originId,learnerId)
     .first<{allowed:number}>();
   return !!live;
  }
  return true;
 }
 if(c.originType==='self_study')return false;
 if(c.originType==='lesson'){
  const acting=await db.prepare(`SELECT 1 AS allowed FROM lessons l
   JOIN teachers t ON t.id=l.actual_teacher_id
   WHERE l.id=? AND l.learner_id=? AND l.status='live'
    AND t.auth_subject=? AND t.qualified=1 AND t.status='active'`)
    .bind(c.originId,learnerId,a.subject).first<{allowed:number}>();
  return !!acting;
 }
 const current=await db.prepare(`SELECT 1 AS allowed FROM learner_assignments task
  JOIN teachers t ON t.auth_subject=task.teacher_auth_subject
  JOIN teacher_assignments grant_row ON grant_row.teacher_id=t.id
   AND grant_row.learner_id=task.learner_id
  JOIN learners l ON l.id=task.learner_id
  JOIN accounts account ON account.id=l.account_id
  WHERE task.id=? AND task.learner_id=? AND task.status='assigned'
    AND t.auth_subject=? AND t.status='active' AND t.qualified=1
    AND l.status='active' AND account.status='active'
    AND grant_row.revoked_at_ms IS NULL
    AND grant_row.starts_at_ms<=? AND grant_row.ends_at_ms>?`)
  .bind(c.originId,learnerId,a.subject,now,now).first<{allowed:number}>();
 return !!current;
}
export async function appendQuranLedgerEvent(db:CoreDatabase,actor:VerifiedQuranActor,
 learnerId:string,raw:unknown,now=Date.now()):Promise<{
 status:number;code:string;item?:QuranLedgerCurrent
}>{
 const c=parseQuranLedgerCommand(raw);
 if(!c)return {status:400,code:'INVALID_QURAN_EVENT'};
 if(actor.role==='learner'&&c.originType==='assignment')
  return {status:403,code:'QURAN_ACCESS_DENIED'};
 if(!await authorized(db,actor,learnerId,c,now))
  return {status:404,code:'NOT_FOUND'};
 const body=JSON.stringify(c.payload);
 const prior=()=>db.prepare(PRIOR).bind(learnerId,c.operationId).first<Prior>();
 const old=await prior();
 if(old&&!same(old,actor,c,body))return {status:409,code:'QURAN_OPERATION_CONFLICT'};
 // A D1 write may commit even when the client loses the insert response.
 // A subsequent exact-match lookup must be acknowledged as a replay.
 let replay=!!old;
 if(!old) {
  try{
   await db.prepare(INSERT).bind(crypto.randomUUID(),learnerId,c.operationId,c.itemId,
    actor.subject,actor.role,c.originType,c.originId,
    c.originType==='self_study'?'private':'shared',c.action,
    PRIVATE_EDITION,c.page,c.surah,c.ayah,c.wordIndex,c.kind,c.expectedRevision,body,now).run();
  }catch(error){
   const raced=await prior();
   if(!raced||!same(raced,actor,c,body)){
    if(error instanceof Error&&/constraint|abort|conflict|denied|revision|anchor|capacity/i.test(error.message))
     return {status:409,code:'QURAN_EVENT_REJECTED'};
    throw error;
   }
   replay=true;
  }
 }
 const row=await db.prepare(ROW).bind(learnerId,c.itemId).first<Row>();
 if(!row)throw Error('Quran event committed without projection');
 return {status:replay?200:201,code:replay?'QURAN_EVENT_REPLAY':'QURAN_EVENT_COMMITTED',
  item:asCurrent(row)};
}
const PAGE_SQL=`SELECT item_id,page,kind,surah,ayah,word_index,visible,revision,audience,
 author_role,author_subject,origin_type,origin_id,payload_json
 FROM learner_quran_current WHERE learner_id=? AND edition_id=? AND page=?
 AND visible=1 ORDER BY updated_at_ms ASC,item_id ASC LIMIT 301`;
/** Owner-only composite read. Legacy private D1 records remain unmigrated and
 * are returned separately, never silently discarded or treated as teacher marks.
 */
export async function readOwnerCumulativePage(db:CoreDatabase,owner:string,
 learnerId:string,p:number){
 if(!page(p))return {status:400,code:'INVALID_QURAN_PAGE'} as const;
 const own=await db.prepare(`SELECT 1 AS allowed FROM learners l JOIN accounts a
  ON a.id=l.account_id WHERE l.id=? AND l.status='active' AND a.status='active'
   AND a.auth_subject=?`).bind(learnerId,owner).first<{allowed:number}>();
 if(!own)return {status:404,code:'NOT_FOUND'} as const;
 const rows=(await db.prepare(PAGE_SQL).bind(learnerId,PRIVATE_EDITION,p)
  .all<Row>()).results;
 if(rows.length>300)return {status:409,code:'QURAN_PAGE_CAPACITY_EXCEEDED'} as const;
 const legacy=await readPrivateMushaf(db,learnerId,p);
 if(legacy.status!==200)return {status:legacy.status,code:legacy.code} as const;
 return {status:200,code:'QURAN_COMPOSITE_READ',current:rows.map(asCurrent),
  legacyPrivate:legacy.items??[]} as const;
}
/** A Sheikh can read only shared academic marks of currently assigned learner.
 * Even when the owner has private ink on that exact page, no private fields pass.
 */
export async function readTeacherSharedPage(db:CoreDatabase,teacher:string,
 learnerId:string,p:number,now=Date.now()){
 if(!page(p))return {status:400,code:'INVALID_QURAN_PAGE'} as const;
 const allowed=await db.prepare(`SELECT 1 AS allowed FROM teacher_assignments grant_row
 JOIN teachers t ON t.id=grant_row.teacher_id
 JOIN learners l ON l.id=grant_row.learner_id
 JOIN accounts a ON a.id=l.account_id
 WHERE grant_row.learner_id=? AND t.auth_subject=? AND t.status='active'
 AND t.qualified=1 AND grant_row.revoked_at_ms IS NULL
 AND grant_row.starts_at_ms<=? AND grant_row.ends_at_ms>?
 AND l.status='active' AND a.status='active' LIMIT 1`)
  .bind(learnerId,teacher,now,now).first<{allowed:number}>();
 if(!allowed)return {status:404,code:'NOT_FOUND'} as const;
 const rows=(await db.prepare(PAGE_SQL.replace('AND visible=1','AND visible=1 AND audience=\'shared\''))
  .bind(learnerId,PRIVATE_EDITION,p).all<Row>()).results;
 if(rows.length>300)return {status:409,code:'QURAN_PAGE_CAPACITY_EXCEEDED'} as const;
 return {status:200,code:'QURAN_SHARED_READ',items:rows.map(asCurrent)} as const;
}
