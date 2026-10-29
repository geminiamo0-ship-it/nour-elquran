import type {CoreDatabase} from './bindings.ts';

export type AssignmentPublish=Readonly<{
 operationId:string; kind:'memorization'|'revision'|'recitation';
 editionId:string;surah:number;fromAyah:number;toAyah:number;
 dueAtMs:number;instructions:string;
}>;
type EventRow={assignment_id:string;learner_id:string;actor_auth_subject:string;
 kind:string;edition_id:string;surah:number;from_ayah:number;to_ayah:number;
 due_at_ms:number;instructions:string};
type AssignmentRow={id:string;learner_id:string;kind:AssignmentPublish['kind'];
 edition_id:string;surah:number;from_ayah:number;to_ayah:number;due_at_ms:number;
 instructions:string;published_at_ms:number;status:'assigned';revision:number;
 start_page:number;end_page:number};
const operationId=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const edition=/^[a-zA-Z0-9_.:-]{1,80}$/;
const keys=['operationId','kind','editionId','surah','fromAyah','toAyah','dueAtMs','instructions'];
export function parsePublishAssignment(raw:unknown):AssignmentPublish|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).length!==keys.length||!keys.every(k=>k in v)||
    typeof v.operationId!=='string'||typeof v.kind!=='string'||typeof v.editionId!=='string'||
    !operationId.test(v.operationId)||!['memorization','revision','recitation'].includes(v.kind)||
    !edition.test(v.editionId)||![v.surah,v.fromAyah,v.toAyah,v.dueAtMs].every(Number.isSafeInteger)||
    Number(v.surah)<1||Number(v.surah)>114||Number(v.fromAyah)<1||
    Number(v.toAyah)<Number(v.fromAyah)||
    typeof v.instructions!=='string'||v.instructions.trim().length<1||
    v.instructions.trim().length>500||Array.from(v.instructions).some(c=>c.charCodeAt(0)<32&&![9,10,13].includes(c.charCodeAt(0))))
   return null;
 return {operationId:v.operationId as string,kind:v.kind as AssignmentPublish['kind'],
  editionId:v.editionId as string,surah:v.surah as number,fromAyah:v.fromAyah as number,
  toAyah:v.toAyah as number,dueAtMs:v.dueAtMs as number,instructions:v.instructions.trim()};
}
async function verifiedCurrentTeacher(db:CoreDatabase,subject:string,learnerId:string,now:number) {
 const row=await db.prepare(`SELECT 1 AS allowed FROM learners l JOIN accounts owner ON owner.id=l.account_id
 JOIN teacher_assignments a ON a.learner_id=l.id
 JOIN teachers t ON t.id=a.teacher_id
 WHERE l.id=? AND l.status='active' AND owner.status='active' AND t.auth_subject=?
 AND t.status='active' AND t.qualified=1 AND a.revoked_at_ms IS NULL
 AND a.starts_at_ms<=? AND a.ends_at_ms>? LIMIT 1`)
 .bind(learnerId,subject,now,now).first<{allowed:number}>();
 return row?.allowed===1;
}
async function verifiedOwner(db:CoreDatabase,subject:string,learnerId:string){
 const row=await db.prepare(`SELECT 1 AS allowed FROM learners l JOIN accounts a ON a.id=l.account_id
 WHERE l.id=? AND l.status='active' AND a.status='active' AND a.auth_subject=? LIMIT 1`)
 .bind(learnerId,subject).first<{allowed:number}>();
 return row?.allowed===1;
}
function project(row:AssignmentRow){
 return {id:row.id,learnerId:row.learner_id,kind:row.kind,editionId:row.edition_id,
  surah:row.surah,fromAyah:row.from_ayah,toAyah:row.to_ayah,dueAtMs:row.due_at_ms,
  instructions:row.instructions,publishedAtMs:row.published_at_ms,
  status:row.status,revision:row.revision,startPage:row.start_page,endPage:row.end_page};
}
async function readRows(db:CoreDatabase,learnerId:string){
 const rows=await db.prepare(`SELECT task.id,task.learner_id,task.kind,task.edition_id,
 task.surah,task.from_ayah,task.to_ayah,task.due_at_ms,task.instructions,
 task.published_at_ms,task.status,task.revision,
 first_anchor.page AS start_page,last_anchor.page AS end_page
 FROM learner_assignments task
 JOIN quran_ayah_anchors first_anchor ON first_anchor.edition_id=task.edition_id
  AND first_anchor.surah=task.surah AND first_anchor.ayah=task.from_ayah
 JOIN quran_ayah_anchors last_anchor ON last_anchor.edition_id=task.edition_id
  AND last_anchor.surah=task.surah AND last_anchor.ayah=task.to_ayah
 WHERE task.learner_id=? AND task.status='assigned'
 ORDER BY task.published_at_ms DESC,task.id DESC LIMIT 100`).bind(learnerId).all<AssignmentRow>();
 return rows.results.map(project);
}
export async function readOwnerAssignments(db:CoreDatabase,subject:string,learnerId:string){
 if(!await verifiedOwner(db,subject,learnerId))return {status:404,code:'NOT_FOUND'} as const;
 return {status:200,assignments:await readRows(db,learnerId)} as const;
}
export async function readTeacherAssignments(db:CoreDatabase,subject:string,learnerId:string,now=Date.now()){
 if(!await verifiedCurrentTeacher(db,subject,learnerId,now))return {status:404,code:'NOT_FOUND'} as const;
 return {status:200,assignments:await readRows(db,learnerId)} as const;
}
export async function getAssignmentCatalog(db:CoreDatabase,subject:string,now=Date.now()){
 const teacher=await db.prepare(`SELECT 1 AS allowed FROM teachers
 WHERE auth_subject=? AND status='active' AND qualified=1 LIMIT 1`)
  .bind(subject).first<{allowed:number}>();
 if(teacher?.allowed!==1)return {status:403,code:'TEACHER_ACCESS_DENIED'} as const;
 const rows=await db.prepare(`SELECT edition_id AS editionId,surah,MAX(ayah) AS ayahCount
 FROM quran_ayah_anchors GROUP BY edition_id,surah ORDER BY edition_id,surah`)
 .all<{editionId:string;surah:number;ayahCount:number}>();
 return {status:200,surahs:rows.results,asOfMs:now} as const;
}
export async function publishAssignment(db:CoreDatabase,subject:string,learnerId:string,command:AssignmentPublish,now=Date.now()){
 // Current role check first: revoked teacher must not replay a historical op.
 if(!await verifiedCurrentTeacher(db,subject,learnerId,now))return {status:404,code:'NOT_FOUND'} as const;
 const find=()=>db.prepare(`SELECT assignment_id,learner_id,actor_auth_subject,kind,edition_id,
 surah,from_ayah,to_ayah,due_at_ms,instructions FROM assignment_publish_events
 WHERE operation_id=?`).bind(command.operationId).first<EventRow>();
 const replay=(row:EventRow)=>{
  if(row.learner_id!==learnerId||row.actor_auth_subject!==subject)
    return {status:404,code:'NOT_FOUND'} as const;
  if(row.kind!==command.kind||row.edition_id!==command.editionId||
     row.surah!==command.surah||row.from_ayah!==command.fromAyah||
     row.to_ayah!==command.toAyah||row.due_at_ms!==command.dueAtMs||
     row.instructions!==command.instructions)
    return {status:409,code:'ASSIGNMENT_OPERATION_CONFLICT'} as const;
  return {status:200,code:'ASSIGNMENT_ALREADY_PUBLISHED',assignmentId:row.assignment_id} as const;
 };
 const prior=await find();
 if(prior)return replay(prior);
 if(command.dueAtMs<=now||command.dueAtMs>now+15552000000)
   return {status:400,code:'ASSIGNMENT_BAD_DUE_DATE'} as const;
 const canon=await db.prepare(`SELECT 1 AS valid FROM quran_ayah_anchors a
 JOIN quran_ayah_anchors b ON b.edition_id=a.edition_id AND b.surah=a.surah
 WHERE a.edition_id=? AND a.surah=? AND a.ayah=? AND b.ayah=? LIMIT 1`)
 .bind(command.editionId,command.surah,command.fromAyah,command.toAyah)
 .first<{valid:number}>();
 if(canon?.valid!==1)return {status:400,code:'ASSIGNMENT_INVALID_RANGE'} as const;
 const id=crypto.randomUUID();
 try{
  await db.prepare(`INSERT INTO assignment_publish_events(operation_id,assignment_id,learner_id,
   actor_auth_subject,kind,edition_id,surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
  .bind(command.operationId,id,learnerId,subject,command.kind,command.editionId,command.surah,
    command.fromAyah,command.toAyah,command.dueAtMs,command.instructions,now).run();
 }catch(error){
  const other=await find();
  if(other)return replay(other);
  if(error instanceof Error){
   if(error.message.includes('ASSIGNMENT_ACCESS_DENIED'))
    return {status:404,code:'NOT_FOUND'} as const;
   if(error.message.includes('ASSIGNMENT_CAP'))
    return {status:409,code:'ASSIGNMENT_LIMIT_REACHED'} as const;
   if(error.message.includes('ASSIGNMENT_BAD_DUE_DATE'))
    return {status:400,code:'ASSIGNMENT_BAD_DUE_DATE'} as const;
   if(error.message.includes('ASSIGNMENT_INVALID_RANGE'))
    return {status:400,code:'ASSIGNMENT_INVALID_RANGE'} as const;
  }
  throw error;
 }
 return {status:201,code:'ASSIGNMENT_PUBLISHED',assignmentId:id} as const;
}
