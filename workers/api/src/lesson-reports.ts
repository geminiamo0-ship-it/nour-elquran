import type {CoreDatabase} from './bindings.ts';

// Reports are tied to a completed lesson, NOT to an editable academic plan.
type Grade=number|null;
export type ReportContent=Readonly<{
 scope:string;strengths:string;corrections:string;nextPlan:string;
 memorization:Grade;recitation:Grade;tajweed:Grade;
}>;
export type ReportAction=
 | Readonly<{kind:'save';operationId:string;expectedRevision:number}&ReportContent>
 | Readonly<{kind:'publish';operationId:string;expectedRevision:number}>;
type ReportRow={lesson_id:string;learner_id:string;revision:number;
 status:'draft'|'published';latest_published_revision:number|null;
 scope:string;strengths:string;corrections:string;next_plan:string;
 memorization:Grade;recitation:Grade;tajweed:Grade;updated_at_ms:number};
type PublishedRow={lesson_id:string;learner_id:string;revision:number;
 scope:string;strengths:string;corrections:string;next_plan:string;
 memorization:Grade;recitation:Grade;tajweed:Grade;published_at_ms:number};
type EventRow={lesson_id:string;actor_auth_subject:string;
 kind:'save'|'publish';expected_revision:number;scope:string;
 strengths:string;corrections:string;next_plan:string;
 memorization:Grade;recitation:Grade;tajweed:Grade};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[])=>
 Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const revision=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
function plain(v:unknown,max:number):v is string {
 return typeof v==='string'&&v.length<=max&&!Array.from(v).some(ch=>{
  const code=ch.charCodeAt(0);return code<32&&code!==9&&code!==10&&code!==13;
 });
}
function grade(v:unknown):v is Grade {
 return v===null||(typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=10);
}
export function parseReportAction(raw:unknown):ReportAction|null {
 if(!obj(raw)||typeof raw.operationId!=='string'||!uuid.test(raw.operationId)||
   !revision(raw.expectedRevision))return null;
 if(raw.kind==='publish')return exact(raw,['kind','operationId','expectedRevision'])
  ?{kind:'publish',operationId:raw.operationId,expectedRevision:raw.expectedRevision as number}:null;
 if(raw.kind!=='save'||!exact(raw,['kind','operationId','expectedRevision','scope',
   'strengths','corrections','nextPlan','memorization','recitation','tajweed'])||
  !plain(raw.scope,700)||!plain(raw.strengths,1000)||!plain(raw.corrections,1000)||
  !plain(raw.nextPlan,1000)||!grade(raw.memorization)||!grade(raw.recitation)||
  !grade(raw.tajweed))return null;
 return {kind:'save',operationId:raw.operationId,expectedRevision:raw.expectedRevision as number,
  scope:raw.scope.trim(),strengths:raw.strengths.trim(),corrections:raw.corrections.trim(),
  nextPlan:raw.nextPlan.trim(),memorization:raw.memorization,
  recitation:raw.recitation,tajweed:raw.tajweed};
}
function content(row:ReportRow|PublishedRow):ReportContent{
 return {scope:row.scope,strengths:row.strengths,corrections:row.corrections,
  nextPlan:row.next_plan,memorization:row.memorization,recitation:row.recitation,tajweed:row.tajweed};
}
const teacherScope=[
 'SELECT 1 AS allowed FROM lessons l',
 'JOIN learners s ON s.id=l.learner_id JOIN accounts owner ON owner.id=s.account_id',
 'JOIN teachers t ON t.id=l.actual_teacher_id',
 "WHERE l.id=? AND t.auth_subject=? AND s.status='active' AND owner.status='active'",
 "AND t.status='active' AND t.qualified=1 AND l.status='completed'",
 'AND l.ended_at_ms IS NOT NULL AND l.ended_at_ms<=?',
 "AND EXISTS (SELECT 1 FROM lesson_lifecycle_events e WHERE e.lesson_id=l.id AND e.action='end'",
 'AND e.teacher_id=t.id AND e.at_ms=l.ended_at_ms)',
 "AND NOT EXISTS (SELECT 1 FROM lesson_access_grants g WHERE g.lesson_id=l.id AND g.teacher_id=t.id AND g.kind='substitute'",
 'AND (g.accepted_at_ms IS NULL OR g.revoked_at_ms IS NOT NULL OR',
 '?>COALESCE((SELECT MIN(p.published_at_ms) FROM lesson_report_publications p WHERE p.lesson_id=l.id),l.ended_at_ms)+86400000))',
 'LIMIT 1'
].join(' ');
async function allowedTeacher(db:CoreDatabase,actor:string,lessonId:string,now:number){
 const row=await db.prepare(teacherScope).bind(lessonId,actor,now,now).first<{allowed:number}>();
 return row?.allowed===1;
}
async function readState(db:CoreDatabase,lessonId:string){
 return db.prepare('SELECT * FROM lesson_report_state WHERE lesson_id=?')
  .bind(lessonId).first<ReportRow>();
}
export async function getTeacherReport(db:CoreDatabase,actor:string,lessonId:string,now=Date.now()){
 if(!await allowedTeacher(db,actor,lessonId,now))return {status:404,code:'NOT_FOUND'} as const;
 const row=await readState(db,lessonId);
 return {status:200,report:row?{
  lessonId,revision:row.revision,status:row.status,
  publishedRevision:row.latest_published_revision,updatedAtMs:row.updated_at_ms,
  ...content(row)}:null} as const;
}
export async function getStudentReports(db:CoreDatabase,actor:string,learnerId:string){
 const owned=await db.prepare([
  'SELECT 1 AS allowed FROM learners s JOIN accounts a ON a.id=s.account_id',
  "WHERE s.id=? AND s.status='active' AND a.status='active' AND a.auth_subject=? LIMIT 1"
 ].join(' ')).bind(learnerId,actor).first<{allowed:number}>();
 if(owned?.allowed!==1)return {status:404,code:'NOT_FOUND'} as const;
 const rows=await db.prepare([
  'SELECT p.* FROM lesson_report_publications p',
  'JOIN lesson_report_state s ON s.lesson_id=p.lesson_id AND s.latest_published_revision=p.revision',
  'WHERE p.learner_id=? ORDER BY p.published_at_ms DESC,p.lesson_id DESC LIMIT 100'
 ].join(' ')).bind(learnerId).all<PublishedRow>();
 return {status:200,reports:rows.results.map(p=>({
  lessonId:p.lesson_id,learnerId:p.learner_id,revision:p.revision,
  publishedAtMs:p.published_at_ms,...content(p)
 }))} as const;
}
export async function applyTeacherReport(db:CoreDatabase,actor:string,lessonId:string,
 command:ReportAction,now=Date.now()){
 // Revalidate at the time of every request. A revoked/expired substitute may not replay.
 if(!await allowedTeacher(db,actor,lessonId,now))return {status:404,code:'NOT_FOUND'} as const;
 const previous=()=>db.prepare([
  'SELECT lesson_id,actor_auth_subject,kind,expected_revision,scope,strengths,corrections,',
  'next_plan,memorization,recitation,tajweed FROM lesson_report_events WHERE operation_id=?'
 ].join(' ')).bind(command.operationId).first<EventRow>();
 const replay=(event:EventRow)=>{
  if(event.lesson_id!==lessonId||event.actor_auth_subject!==actor)
   return {status:404,code:'NOT_FOUND'} as const;
  if(event.kind!==command.kind||event.expected_revision!==command.expectedRevision||
     (command.kind==='save'&&(event.scope!==command.scope||
       event.strengths!==command.strengths||event.corrections!==command.corrections||
       event.next_plan!==command.nextPlan||event.memorization!==command.memorization||
       event.recitation!==command.recitation||event.tajweed!==command.tajweed)))
   return {status:409,code:'REPORT_OPERATION_CONFLICT'} as const;
  return {status:200,code:'REPORT_ALREADY_APPLIED',
   revision:command.expectedRevision+(command.kind==='save'?1:0)} as const;
 };
 const old=await previous();if(old)return replay(old);
 const current=await readState(db,lessonId),rev=current?.revision??0;
 if(rev!==command.expectedRevision)return {status:409,code:'REPORT_REVISION_CONFLICT'} as const;
 if(command.kind==='publish'&&(!current||current.status!=='draft'||!current.scope.trim()))
  return {status:409,code:'REPORT_NOT_READY_TO_PUBLISH'} as const;
 const input=command.kind==='save'?command:content(current!);
 const lesson=await db.prepare('SELECT learner_id FROM lessons WHERE id=?').bind(lessonId)
  .first<{learner_id:string}>();
 if(!lesson)return {status:404,code:'NOT_FOUND'} as const;
 try{
  await db.prepare([
   'INSERT INTO lesson_report_events(operation_id,lesson_id,learner_id,actor_auth_subject,',
   'kind,expected_revision,scope,strengths,corrections,next_plan,memorization,recitation,tajweed,at_ms)',
   'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ].join(' ')).bind(command.operationId,lessonId,lesson.learner_id,actor,
   command.kind,command.expectedRevision,input.scope,input.strengths,input.corrections,
   input.nextPlan,input.memorization,input.recitation,input.tajweed,now).run();
 }catch(e){
  const raced=await previous();if(raced)return replay(raced);
  if(e instanceof Error){
   if(e.message.includes('REPORT_REVISION_CONFLICT'))
    return {status:409,code:'REPORT_REVISION_CONFLICT'} as const;
   if(e.message.includes('REPORT_NOT_READY_TO_PUBLISH'))
    return {status:409,code:'REPORT_NOT_READY_TO_PUBLISH'} as const;
   if(e.message.includes('REPORT_ACCESS_DENIED')||e.message.includes('REPORT_SUBSTITUTE_DENIED'))
    return {status:404,code:'NOT_FOUND'} as const;
  }
  throw e;
 }
 return {status:command.kind==='save'?200:201,
  code:command.kind==='save'?'REPORT_DRAFT_SAVED':'REPORT_PUBLISHED',
  revision:rev+(command.kind==='save'?1:0)} as const;
}
