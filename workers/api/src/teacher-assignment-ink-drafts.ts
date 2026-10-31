import type {CoreDatabase} from './bindings.ts';
import {parsePublishAssignment,verifiedCurrentTeacher,type AssignmentPublish} from './published-assignments.ts';

export type DraftMark=Readonly<{
 id:string;kind:'pen'|'marker'|'note'|'highlight';page:number;
 surah:number|null;ayah:number|null;
 payload:Readonly<Record<string,unknown>>;
}>;
export type DraftSave=Readonly<{
 draftId:string;revision:number;kind:AssignmentPublish['kind'];
 editionId:string;surah:number;fromAyah:number;toAyah:number;
 dueAtMs:number;instructions:string;marks:readonly DraftMark[];
}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function exact(x:Record<string,unknown>,fields:readonly string[]){return Object.keys(x).length===fields.length&&fields.every(f=>Object.hasOwn(x,f));}
const color=/^#[a-f\d]{6}$/i;
function mark(raw:unknown):DraftMark|null{
 if(!isObject(raw)||!exact(raw,['id','kind','page','surah','ayah','payload'])||
  typeof raw.id!=='string'||!/^[A-Za-z0-9_-]{8,40}$/.test(raw.id)||
  !['pen','marker','note','highlight'].includes(String(raw.kind))||
  !Number.isInteger(raw.page)||Number(raw.page)<1||Number(raw.page)>604||
  !isObject(raw.payload)||typeof raw.payload.color!=='string'||!color.test(raw.payload.color))
  return null;
 const kind=raw.kind as DraftMark['kind'];
 if(kind==='pen'||kind==='marker'){
  if(raw.surah!==null||raw.ayah!==null||
    !exact(raw.payload,['color','width','points'])||
    typeof raw.payload.width!=='number'||!Number.isFinite(raw.payload.width)||
    raw.payload.width<1||raw.payload.width>60||!Array.isArray(raw.payload.points)||
    raw.payload.points.length<2||raw.payload.points.length>600||
    !raw.payload.points.every((p:unknown)=>isObject(p)&&exact(p,['x','y'])&&
      typeof p.x==='number'&&Number.isFinite(p.x)&&p.x>=0&&p.x<=1000&&
      typeof p.y==='number'&&Number.isFinite(p.y)&&p.y>=0&&p.y<=1594))
   return null;
 }else{
  if(!Number.isInteger(raw.surah)||Number(raw.surah)<1||Number(raw.surah)>114||
     !Number.isInteger(raw.ayah)||Number(raw.ayah)<1)return null;
  if(kind==='note'&&(!exact(raw.payload,['color','text'])||
    typeof raw.payload.text!=='string'||!raw.payload.text.trim()||
    raw.payload.text.length>500))return null;
  if(kind==='highlight'&&!exact(raw.payload,['color']))return null;
 }
 return raw as DraftMark;
}
/** Stable, non-sensitive D1 reason for staging QA: no SQL, IDs or payloads. */
export function draftStorageFailureKind(error:unknown):'D1_JSON'|'D1_SCHEMA'|'D1_CONSTRAINT'|'D1_NETWORK'|'D1_UNKNOWN'{
 const msg=error instanceof Error?error.message.toLowerCase():'';
 if(/json|malformed|path error/.test(msg))return 'D1_JSON';
 if(/no such table|no such column|migration|schema/.test(msg))return 'D1_SCHEMA';
 if(/constraint|foreign key|unique|check failed/.test(msg))return 'D1_CONSTRAINT';
 if(/timeout|unavailable|connection|network|busy/.test(msg))return 'D1_NETWORK';
 return 'D1_UNKNOWN';
}
const saveFields=['draftId','revision','kind','editionId','surah','fromAyah',
 'toAyah','dueAtMs','instructions','marks'] as const;
export function parseTeacherDraftSave(raw:unknown):DraftSave|null{
 if(!isObject(raw)||!exact(raw,saveFields)||typeof raw.draftId!=='string'||
   !uuid.test(raw.draftId)||!Number.isSafeInteger(raw.revision)||
   Number(raw.revision)<1||Number(raw.revision)>1000||
   !Array.isArray(raw.marks)||raw.marks.length>24)return null;
 const assignment=parsePublishAssignment({
  operationId:raw.draftId,kind:raw.kind,editionId:raw.editionId,
  surah:raw.surah,fromAyah:raw.fromAyah,toAyah:raw.toAyah,
  dueAtMs:raw.dueAtMs,instructions:raw.instructions});
 if(!assignment)return null;
 const marks=raw.marks.map(mark);
 if(marks.some(m=>m===null)||new Set(marks.map(m=>m!.id)).size!==marks.length)return null;
 const normalized={draftId:raw.draftId,revision:raw.revision,...assignment,marks} as Record<string,unknown>;
 delete normalized.operationId;
 if(JSON.stringify(marks).length>180000)return null;
 return normalized as DraftSave;
}
type Stored=Readonly<{
 draft_id:string;revision:number;learner_id:string;teacher_subject:string;
 kind:DraftSave['kind'];edition_id:string;surah:number;from_ayah:number;to_ayah:number;
 due_at_ms:number;instructions:string;marks_json:string;at_ms:number;
}>;
const select=`SELECT draft_id,revision,learner_id,teacher_subject,kind,edition_id,
 surah,from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms
 FROM teacher_assignment_draft_versions WHERE draft_id=? AND revision=?`;
const latest=`SELECT MAX(revision) AS revision
 FROM teacher_assignment_draft_versions WHERE draft_id=?`;
function same(stored:Stored,c:DraftSave,learnerId:string,subject:string){
 return stored.draft_id===c.draftId&&stored.revision===c.revision&&
 stored.learner_id===learnerId&&stored.teacher_subject===subject&&
 stored.kind===c.kind&&stored.edition_id===c.editionId&&stored.surah===c.surah&&
 stored.from_ayah===c.fromAyah&&stored.to_ayah===c.toAyah&&
 stored.due_at_ms===c.dueAtMs&&stored.instructions===c.instructions&&
 stored.marks_json===JSON.stringify(c.marks);
}
function project(r:Stored){
 return {draftId:r.draft_id,revision:r.revision,learnerId:r.learner_id,
  kind:r.kind,editionId:r.edition_id,surah:r.surah,fromAyah:r.from_ayah,
  toAyah:r.to_ayah,dueAtMs:r.due_at_ms,instructions:r.instructions,
  marks:JSON.parse(r.marks_json) as readonly DraftMark[],updatedAtMs:r.at_ms};
}
export async function readTeacherInkDrafts(db:CoreDatabase,subject:string,
 learnerId:string,now=Date.now()){
 if(!await verifiedCurrentTeacher(db,subject,learnerId,now))
  return {status:404,code:'NOT_FOUND'} as const;
 const rows=await db.prepare(`SELECT v.draft_id,v.revision,v.learner_id,v.teacher_subject,
 v.kind,v.edition_id,v.surah,v.from_ayah,v.to_ayah,v.due_at_ms,v.instructions,
 v.marks_json,v.at_ms FROM teacher_assignment_draft_versions v
 WHERE v.teacher_subject=? AND v.learner_id=?
 AND v.revision=(SELECT MAX(next.revision) FROM teacher_assignment_draft_versions next
   WHERE next.draft_id=v.draft_id)
 AND NOT EXISTS(SELECT 1 FROM teacher_assignment_draft_publications p
   WHERE p.draft_id=v.draft_id)
 ORDER BY v.at_ms DESC,v.draft_id DESC LIMIT 30`)
 .bind(subject,learnerId).all<Stored>();
 return {status:200,drafts:rows.results.map(project)} as const;
}
export async function saveTeacherInkDraft(db:CoreDatabase,subject:string,
 learnerId:string,raw:unknown,now=Date.now(),diagnostics=false){
 const c=parseTeacherDraftSave(raw);
 if(!c)return {status:400,code:'INVALID_DRAFT'} as const;
 if(!await verifiedCurrentTeacher(db,subject,learnerId,now))
  return {status:404,code:'NOT_FOUND'} as const;
 if(c.dueAtMs<=now||c.dueAtMs>now+15552000000)
  return {status:400,code:'DRAFT_BAD_DUE_DATE'} as const;
 const find=()=>db.prepare(select).bind(c.draftId,c.revision).first<Stored>();
 const prior=await find();
 if(prior)return same(prior,c,learnerId,subject)?
  {status:200,code:'DRAFT_ALREADY_SAVED',draft:project(prior)} as const:
  {status:409,code:'DRAFT_REVISION_CONFLICT'} as const;
 const version=await db.prepare(latest).bind(c.draftId).first<{revision:number|null}>();
 if(c.revision!==(version?.revision??0)+1)
  return {status:409,code:'DRAFT_REVISION_CONFLICT'} as const;
 try{
  await db.prepare(`INSERT INTO teacher_assignment_draft_versions(
   draft_id,revision,learner_id,teacher_subject,kind,edition_id,surah,from_ayah,
   to_ayah,due_at_ms,instructions,marks_json,at_ms)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .bind(c.draftId,c.revision,learnerId,subject,c.kind,c.editionId,c.surah,
   c.fromAyah,c.toAyah,c.dueAtMs,c.instructions,JSON.stringify(c.marks),now).run();
 }catch(error){
  const raced=await find();
  if(raced&&same(raced,c,learnerId,subject))
   return {status:200,code:'DRAFT_ALREADY_SAVED',draft:project(raced)} as const;
  if(error instanceof Error&&/constraint|abort|conflict|denied|range|marks|published/i.test(error.message))
   return {status:409,code:'DRAFT_WRITE_REJECTED'} as const;
  // Keep raw SQL, mark coordinates and auth subjects private. Do not pretend
  // a D1 write exception is a generic sign-in failure.
  return {status:503,code:'DRAFT_STORAGE_UNAVAILABLE',
   ...(diagnostics?{reason:draftStorageFailureKind(error)}:{})} as const;
 }
 return {status:201,code:'DRAFT_SAVED',draft:{...c,learnerId,updatedAtMs:now}} as const;
}
export async function latestTeacherDraft(db:CoreDatabase,draftId:string){
 if(!uuid.test(draftId))return null;
 const v=await db.prepare(`SELECT v.draft_id,v.revision,v.learner_id,v.teacher_subject,
 v.kind,v.edition_id,v.surah,v.from_ayah,v.to_ayah,v.due_at_ms,
 v.instructions,v.marks_json,v.at_ms FROM teacher_assignment_draft_versions v
 WHERE v.draft_id=? ORDER BY v.revision DESC LIMIT 1`).bind(draftId).first<Stored>();
 return v;
}

export async function teacherAssignmentPageRange(db:CoreDatabase,subject:string,learnerId:string,
 editionId:string,surah:number,fromAyah:number,toAyah:number,now=Date.now()){
 if(!await verifiedCurrentTeacher(db,subject,learnerId,now))
  return {status:404,code:'NOT_FOUND'} as const;
 if(!/^[A-Za-z0-9_.:-]{1,80}$/.test(editionId)||
  !Number.isInteger(surah)||surah<1||surah>114||
  !Number.isInteger(fromAyah)||fromAyah<1||
  !Number.isInteger(toAyah)||toAyah<fromAyah)
  return {status:400,code:'DRAFT_INVALID_RANGE'} as const;
 const pages=await db.prepare(`SELECT a.page AS startPage,b.page AS endPage FROM
  quran_ayah_anchors a JOIN quran_ayah_anchors b
  ON b.edition_id=a.edition_id AND b.surah=a.surah
  WHERE a.edition_id=? AND a.surah=? AND a.ayah=? AND b.ayah=? LIMIT 1`)
  .bind(editionId,surah,fromAyah,toAyah)
  .first<{startPage:number;endPage:number}>();
 if(!pages||pages.startPage>pages.endPage)return {status:400,code:'DRAFT_INVALID_RANGE'} as const;
 return {status:200,code:'DRAFT_RANGE',...pages} as const;
}
