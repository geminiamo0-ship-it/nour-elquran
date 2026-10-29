import type {CoreDatabase} from './bindings.ts';

export const PRIVATE_EDITION='hafs-kfqc:v1.1.1';
export type PrivateKind='pen'|'marker'|'note'|'highlight'|'bookmark'|'position';
export type PrivateAction='put'|'hide'|'restore';
export type PrivateMushafOp=Readonly<{
 operationId:string;action:PrivateAction;itemId:string;kind:PrivateKind;
 page:number;expectedVersion:number;payload:Record<string,unknown>;
}>;
export type PrivateMushafItem=Readonly<{
 itemId:string;kind:PrivateKind;page:number;version:number;visible:boolean;
 payload:Record<string,unknown>;
}>;
const ID=/^[A-Za-z0-9_:.-]{1,128}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HEX=/^#[0-9a-fA-F]{6}$/;
const KIND=['pen','marker','note','highlight','bookmark','position'] as const;
const ACTION=['put','hide','restore'] as const;
const plain=(value:unknown):value is Record<string,unknown> =>
 !!value && typeof value==='object' && !Array.isArray(value);
const page=(n:unknown):n is number => Number.isInteger(n)&&Number(n)>=1&&Number(n)<=604;
const bounded=(n:unknown,max:number):n is number => typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
function exact(obj:Record<string,unknown>,keys:string[]):boolean{
 return Object.keys(obj).length===keys.length && Object.keys(obj).every(k=>keys.includes(k));
}
function safePayload(kind:PrivateKind,data:Record<string,unknown>):boolean {
 if(kind==='pen'||kind==='marker'){
  if(!exact(data,['points','color','width'])||!Array.isArray(data.points)||
    data.points.length<2||data.points.length>2500||!HEX.test(String(data.color))||
    !bounded(data.width,60)||Number(data.width)<1)return false;
  return data.points.every((p:unknown)=>plain(p)&&exact(p,['x','y'])&&
    bounded(p.x,1000)&&bounded(p.y,1594));
 }
 if(kind==='note'||kind==='highlight'){
  if(!exact(data,kind==='note'?['target','text','color']:['target','color'])||
    (kind==='note'&&(typeof data.text!=='string'||
    data.text.trim().length<1||data.text.length>500))||!HEX.test(String(data.color))||
    !plain(data.target)||!exact(data.target,['surah','ayah','wordIndex']))return false;
  const t=data.target;
  return Number.isInteger(t.surah)&&Number(t.surah)>=1&&Number(t.surah)<=114&&
    Number.isInteger(t.ayah)&&Number(t.ayah)>=1&&
    (t.wordIndex===null||(Number.isInteger(t.wordIndex)&&Number(t.wordIndex)>=1));
 }
 return exact(data,[]);
}
export function parsePrivateMushafOp(value:unknown):PrivateMushafOp|null {
 if(!plain(value)||!exact(value,['operationId','action','itemId','kind','page','expectedVersion','payload'])||
   typeof value.operationId!=='string'||!UUID.test(value.operationId)||
   typeof value.action!=='string'||!ACTION.includes(value.action as PrivateAction)||
   typeof value.kind!=='string'||!KIND.includes(value.kind as PrivateKind)||
   typeof value.itemId!=='string'||!ID.test(value.itemId)||!page(value.page)||
   !Number.isSafeInteger(value.expectedVersion)||Number(value.expectedVersion)<0||
   !plain(value.payload))return null;
 const action=value.action as PrivateAction,kind=value.kind as PrivateKind;
 if(kind==='position'&&value.itemId!=='position')return null;
 if(kind==='bookmark'&&value.itemId!=='bookmark-'+value.page)return null;
 if(kind==='note'&&!value.itemId.startsWith('note-'))return null;
 if(kind==='highlight'&&!value.itemId.startsWith('highlight-'))return null;
 if(action!=='put'&&(!exact(value.payload,[])||Number(value.expectedVersion)===0))return null;
 if(action==='put'&&!safePayload(kind,value.payload))return null;
 if(kind==='position'&&action!=='put')return null;
 return {operationId:value.operationId,action,itemId:value.itemId,kind,page:value.page,
   expectedVersion:value.expectedVersion as number,payload:value.payload};
}
export const MUSHAF_EVENT_INSERT_SQL=`
 INSERT INTO private_mushaf_events(id,learner_id,actor_auth_subject,operation_id,
  action,item_id,kind,edition_id,page,expected_version,payload_json,at_ms)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
`;
type Previous={actor:string;action:string;item_id:string;kind:string;page:number;
 expected_version:number;payload_json:string};
const PREVIOUS_SQL=`SELECT actor_auth_subject AS actor,action,item_id,kind,page,
 expected_version,payload_json FROM private_mushaf_events
 WHERE learner_id=? AND operation_id=?`;
const ITEM_SQL=`SELECT item_id AS itemId,kind,page,version,visible,payload_json AS payloadJson
 FROM private_mushaf_items WHERE learner_id=? AND item_id=?`;
type Row={itemId:string;kind:PrivateKind;page:number;version:number;visible:number;payloadJson:string};
function asItem(row:Row):PrivateMushafItem {
 return {itemId:row.itemId,kind:row.kind,page:row.page,version:row.version,
   visible:row.visible===1,payload:JSON.parse(row.payloadJson) as Record<string,unknown>};
}
function same(prior:Previous,actor:string,op:PrivateMushafOp,serialized:string):boolean{
 return prior.actor===actor&&prior.action===op.action&&prior.item_id===op.itemId&&
   prior.kind===op.kind&&prior.page===op.page&&
   prior.expected_version===op.expectedVersion&&prior.payload_json===serialized;
}
export async function applyPrivateMushaf(
 db:CoreDatabase,actor:string,learnerId:string,op:PrivateMushafOp,
):Promise<{status:number;code:string;item?:PrivateMushafItem}>{
 const serialized=JSON.stringify(op.payload);
 const previous=()=>db.prepare(PREVIOUS_SQL).bind(learnerId,op.operationId).first<Previous>();
 const was=await previous();
 if(was&&!same(was,actor,op,serialized))return {status:409,code:'OPERATION_ID_CONFLICT'};
 if(!was) {
  try {
   await db.prepare(MUSHAF_EVENT_INSERT_SQL).bind(crypto.randomUUID(),learnerId,actor,op.operationId,
     op.action,op.itemId,op.kind,PRIVATE_EDITION,op.page,op.expectedVersion,serialized,Date.now()).run();
  } catch(error){
   const raced=await previous();
   if(raced&&!same(raced,actor,op,serialized))return {status:409,code:'OPERATION_ID_CONFLICT'};
   if(!raced){
    if(error instanceof Error && /constraint|abort|mismatch|denied|unavailable|anchor|version/i.test(error.message))
      return {status:409,code:'QURAN_WRITE_DENIED'};
    throw error;
   }
  }
 }
 const row=await db.prepare(ITEM_SQL).bind(learnerId,op.itemId).first<Row>();
 if(!row)throw Error('Private Quran operation committed without item');
 return {status:was?200:201,code:was?'OPERATION_ALREADY_APPLIED':'QURAN_SAVED',item:asItem(row)};
}
// Return hidden stable-ID notes/highlights/bookmarks to recover CAS versions after
// reload, but exclude tombstoned freehand strokes (new strokes use new IDs).
// Consumers render only visible=true; hidden rows never become visible by reading.
const PAGE_SQL=`SELECT item_id AS itemId,kind,page,version,visible,payload_json AS payloadJson
 FROM private_mushaf_items WHERE learner_id=? AND edition_id=?
   AND page=? AND kind IN ('pen','marker','note','highlight')
   AND (visible=1 OR kind IN ('note','highlight'))
 ORDER BY updated_at_ms ASC,item_id ASC LIMIT 301`;
const INDEX_SQL=`SELECT item_id AS itemId,kind,page,version,visible,payload_json AS payloadJson
 FROM private_mushaf_items WHERE learner_id=? AND edition_id=?
   AND kind IN ('note','highlight','bookmark','position')
 ORDER BY updated_at_ms ASC,item_id ASC LIMIT 301`;
export async function readPrivateMushaf(db:CoreDatabase,learnerId:string,selectedPage:number|null):
 Promise<{status:number;code:string;items?:PrivateMushafItem[]}>{
 const query=selectedPage===null?INDEX_SQL:PAGE_SQL;
 const bound=selectedPage===null?[learnerId,PRIVATE_EDITION]:[learnerId,PRIVATE_EDITION,selectedPage];
 const rows=(await db.prepare(query).bind(...bound).all<Row>()).results;
 if(rows.length>300)return {status:409,code:'QURAN_PAGE_CAPACITY_EXCEEDED'};
 return {status:200,code:'QURAN_LOADED',items:rows.map(asItem)};
}
