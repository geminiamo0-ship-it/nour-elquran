/** Authenticated D1 lesson lifecycle. The 40-minute reservation is NOT an
 * automatic timer; only the current qualified acting Sheikh writes Start/End.
 * A D1 batch commits the status transition and immutable audit as ONE unit.
 */
import type {CoreDatabase,Env} from '../bindings.ts';
import {forwardVerifiedPresence} from './presence.ts';
import {wakeLessonMediaReconciliation} from './media-enforcement.ts';
import {forwardCorrections,type Correction} from './live-corrections.ts';
import {applyTeacherReport} from '../lesson-reports.ts';

const id=/^[A-Za-z0-9-]{1,128}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Action='start'|'end';
type Phase='scheduled'|'live'|'completed'|'cancelled';
type Row={id:string;learnerId:string;teacherId:string;status:Phase;
 startsAtMs:number;endsAtMs:number;endedAtMs:number|null};
export type SafeLifecycle=Readonly<{
 lessonId:string;phase:Phase;startedAtMs:number|null;endedAtMs:number|null;
 reservedUntilMs:number;instructionMinutes:30;reservationMinutes:40;
}>;
type EventRow={at_ms:number;action:Action};
function prepareDraft(notes:readonly Correction[]){
 const category:Record<Correction['kind'],string>={
  memorization:'الحفظ',recitation:'التلاوة',tajweed:'التجويد',
  pronunciation:'النطق',general:'ملاحظة عامة'
 };
 const refs=[...new Set(notes.filter(x=>x.surah!==null)
  .map(x=>x.surah+':'+x.ayah))];
 return {
  scope:(refs.length?'آيات الحصة: '+refs.join('، '):'ملاحظات الحصة').slice(0,700),
  strengths:'',corrections:notes.map(n=>
   category[n.kind]+(n.surah===null?'':' ('+n.surah+':'+n.ayah+'):')+' '+n.text)
   .join('\n').slice(0,1000),
  nextPlan:'مراجعة التصحيحات المسجلة أثناء الحصة.',
  memorization:null,recitation:null,tajweed:null,
 };
}

type Snapshot=Readonly<{status:200;code:'LESSON_LIFECYCLE';lifecycle:SafeLifecycle}|
 {status:404|503;code:string}>;
export function parseLifecycleAction(raw:unknown):{action:Action;operationId:string}|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const value=raw as Record<string,unknown>;
 if(Object.keys(value).length!==2||
  (value.action!=='start'&&value.action!=='end')||
  typeof value.operationId!=='string'||!uuid.test(value.operationId))return null;
 return {action:value.action,operationId:value.operationId};
}
const scope=`
 JOIN teachers t ON t.id=l.actual_teacher_id
 JOIN learners learner ON learner.id=l.learner_id
 JOIN accounts owner ON owner.id=learner.account_id
 WHERE l.id=? AND t.auth_subject=? AND t.status='active' AND t.qualified=1
 AND learner.status='active' AND owner.status='active'
 AND (
  EXISTS(SELECT 1 FROM teacher_assignments a
    WHERE a.teacher_id=t.id AND a.learner_id=l.learner_id
    AND a.revoked_at_ms IS NULL AND a.starts_at_ms<=l.starts_at_ms
    AND a.ends_at_ms>=l.ends_at_ms)
  OR EXISTS(SELECT 1 FROM lesson_access_grants g
    WHERE g.lesson_id=l.id AND g.learner_id=l.learner_id
    AND g.teacher_id=t.id AND g.revoked_at_ms IS NULL
    AND g.starts_at_ms<=l.starts_at_ms AND g.ends_at_ms>=l.ends_at_ms
    AND (g.kind='primary' OR (g.kind='substitute'
      AND g.accepted_at_ms IS NOT NULL AND g.consent_deadline_ms IS NOT NULL
      AND g.accepted_at_ms<=g.consent_deadline_ms AND g.accepted_at_ms<=?)))
 )
`;
async function teacherRow(db:CoreDatabase,subject:string,lessonId:string,now:number){
 return db.prepare(`SELECT l.id,l.learner_id AS learnerId,t.id AS teacherId,
 l.status,l.starts_at_ms AS startsAtMs,l.ends_at_ms AS endsAtMs,
 l.ended_at_ms AS endedAtMs FROM lessons l `+scope+' LIMIT 1')
 .bind(lessonId,subject,now).first<Row>();
}
async function ownerRow(db:CoreDatabase,subject:string,learnerId:string,lessonId:string){
 return db.prepare(`SELECT l.id,l.learner_id AS learnerId,
 l.status,l.starts_at_ms AS startsAtMs,l.ends_at_ms AS endsAtMs,
 l.ended_at_ms AS endedAtMs FROM lessons l
 JOIN learners learner ON learner.id=l.learner_id
 JOIN accounts owner ON owner.id=learner.account_id
 WHERE l.id=? AND l.learner_id=? AND owner.auth_subject=?
 AND learner.status='active' AND owner.status='active' LIMIT 1`)
 .bind(lessonId,learnerId,subject).first<Omit<Row,'teacherId'>>();
}
async function safe(db:CoreDatabase,row:Pick<Row,'id'|'status'|'startsAtMs'|'endsAtMs'|'endedAtMs'>):
 Promise<SafeLifecycle>{
 const events=await db.prepare(`SELECT action,at_ms FROM lesson_lifecycle_events
 WHERE lesson_id=? ORDER BY at_ms LIMIT 2`).bind(row.id).all<EventRow>();
 const started=events.results.find(e=>e.action==='start');
 return {lessonId:row.id,phase:row.status,startedAtMs:started?.at_ms??null,
  endedAtMs:row.endedAtMs,reservedUntilMs:row.endsAtMs,
  instructionMinutes:30,reservationMinutes:40};
}
export async function readTeacherLifecycle(env:Env,subject:string,lessonId:string,
 now=Date.now()):Promise<Snapshot>{
 if(!env.DB)return {status:503,code:'DATABASE_UNAVAILABLE'};
 if(!id.test(lessonId))return {status:404,code:'NOT_FOUND'};
 try{
  const row=await teacherRow(env.DB,subject,lessonId,now);
  return row?{status:200,code:'LESSON_LIFECYCLE',lifecycle:await safe(env.DB,row)}:
   {status:404,code:'NOT_FOUND'};
 }catch{return {status:503,code:'LIFECYCLE_UNAVAILABLE'};}
}
export async function readLearnerLifecycle(env:Env,subject:string,learnerId:string,
 lessonId:string):Promise<Snapshot>{
 if(!env.DB)return {status:503,code:'DATABASE_UNAVAILABLE'};
 if(!id.test(lessonId)||!id.test(learnerId))return {status:404,code:'NOT_FOUND'};
 try{
  const row=await ownerRow(env.DB,subject,learnerId,lessonId);
  return row?{status:200,code:'LESSON_LIFECYCLE',lifecycle:await safe(env.DB,row)}:
   {status:404,code:'NOT_FOUND'};
 }catch{return {status:503,code:'LIFECYCLE_UNAVAILABLE'};}
}
/** Atomic update followed by event insert guarded by the preceding UPDATE's
 * changes() value. SQLite D1 batch rolls back the entire batch on error.
 * No client-supplied role/teacher/learner/status/timestamp is ever persisted.
 */
export async function teacherLifecycleAction(env:Env,subject:string,lessonId:string,
 action:Action,operationId:string,now=Date.now()):Promise<
 {status:200|404|409|503;code:string;lifecycle?:SafeLifecycle;mediaRevocation?:string;
 reportDraft?:'created'|'empty'|'retry_needed'}>{
 if(!env.DB)return {status:503,code:'DATABASE_UNAVAILABLE'};
 const db=env.DB;
 if(!id.test(lessonId)||!uuid.test(operationId))return {status:404,code:'NOT_FOUND'};
 try{
  const row=await teacherRow(db,subject,lessonId,now);
  if(!row)return {status:404,code:'NOT_FOUND'};
  if(row.status==='cancelled')return {status:409,code:'LESSON_CANCELLED'};
  if(row.status==='completed'||(action==='start'&&row.status==='live')){
   return {status:200,code:row.status==='completed'?'LESSON_ALREADY_ENDED':'LESSON_ALREADY_STARTED',
    lifecycle:await safe(db,row)};
  }
  if(action==='end'&&row.status!=='live')return {status:409,code:'LESSON_NOT_STARTED'};
  if(action==='start'&&row.status!=='scheduled')return {status:409,code:'LESSON_STATE_CONFLICT'};
  if(now<row.startsAtMs)return {status:409,code:'LESSON_NOT_STARTED_YET'};
  if(!db.batch)return {status:503,code:'ATOMIC_D1_BATCH_REQUIRED'};
  if(action==='start'){
   const p=await forwardVerifiedPresence(env,{lessonId,learnerId:row.learnerId,
    actorSubject:subject,role:'teacher'},'heartbeat');
   if(p.status!==200||!p.presence.bothPresent)
    return {status:409,code:'WAITING_FOR_PARTICIPANTS'};
  }
  // Enforce teacher identity and learner status again inside D1 UPDATE, not
  // only against the earlier application-side read.
  const allow=`EXISTS(SELECT 1 FROM teachers t JOIN learners learner
    ON learner.id=lessons.learner_id JOIN accounts owner ON owner.id=learner.account_id
    WHERE t.id=lessons.actual_teacher_id AND t.auth_subject=?
    AND t.status='active' AND t.qualified=1
    AND learner.status='active' AND owner.status='active'
    AND (EXISTS(SELECT 1 FROM teacher_assignments a WHERE
      a.teacher_id=t.id AND a.learner_id=lessons.learner_id AND a.revoked_at_ms IS NULL
      AND a.starts_at_ms<=lessons.starts_at_ms AND a.ends_at_ms>=lessons.ends_at_ms)
    OR EXISTS(SELECT 1 FROM lesson_access_grants g WHERE
      g.lesson_id=lessons.id AND g.teacher_id=t.id AND g.learner_id=lessons.learner_id
      AND g.revoked_at_ms IS NULL AND g.starts_at_ms<=lessons.starts_at_ms
      AND g.ends_at_ms>=lessons.ends_at_ms AND (g.kind='primary' OR
      (g.kind='substitute' AND g.accepted_at_ms IS NOT NULL
       AND g.consent_deadline_ms IS NOT NULL
       AND g.accepted_at_ms<=g.consent_deadline_ms AND g.accepted_at_ms<=?)))))`;
  const update=action==='start'?
   db.prepare(`UPDATE lessons SET status='live' WHERE id=? AND status='scheduled'
    AND starts_at_ms<=? AND `+allow).bind(lessonId,now,subject,now):
   db.prepare(`UPDATE lessons SET status='completed',ended_at_ms=?
    WHERE id=? AND status='live' AND starts_at_ms<=? AND `+allow)
    .bind(now,lessonId,now,subject,now);
  const event=db.prepare(`INSERT INTO lesson_lifecycle_events
   (id,lesson_id,teacher_id,action,at_ms,operation_id)
   SELECT ?,l.id,l.actual_teacher_id,?,?,? FROM lessons l
   WHERE l.id=? AND l.status=? AND changes()=1
     AND NOT EXISTS(SELECT 1 FROM lesson_lifecycle_events e
      WHERE e.lesson_id=l.id AND e.action=?)`)
   .bind(crypto.randomUUID(),action,now,operationId,lessonId,
    action==='start'?'live':'completed',action);
  const results=await db.batch([update,event]);
  if(results.length!==2)return {status:503,code:'LIFECYCLE_UNAVAILABLE'};
  const fresh=await teacherRow(db,subject,lessonId,now);
  if(!fresh)return {status:404,code:'NOT_FOUND'};
  const state=await safe(db,fresh);
  const eventWritten=results[0]?.success===true&&results[1]?.success===true&&
   results[0]?.meta.changes===1&&results[1]?.meta.changes===1;
  if(!eventWritten){
   // May be a competing request. Require a real prior Start audit, and never
   // report a newly committed transition if its paired audit is absent.
   if((state.phase==='completed'&&state.startedAtMs!==null)||
     (state.phase==='live'&&action==='start'&&state.startedAtMs!==null))
    return {status:200,code:state.phase==='completed'?'LESSON_ALREADY_ENDED':'LESSON_ALREADY_STARTED',
     lifecycle:state};
   return {status:409,code:'LESSON_STATE_CONFLICT'};
  }
  if(action==='end'){
   // Ending is already committed. A missing report service must never silently
   // roll back or reopen the lesson. Draft remains PRIVATE until Sheikh publish.
   let reportDraft:'created'|'empty'|'retry_needed'='retry_needed';
   try{
    const seed=await forwardCorrections(env,{lessonId,learnerId:row.learnerId,
     actorSubject:subject,role:'teacher'},'seed');
    if(seed.status===200&&seed.corrections){
     if(!seed.corrections.items.length)reportDraft='empty';
     else{
      const draft=prepareDraft(seed.corrections.items);
      const written=await applyTeacherReport(db,subject,lessonId,{
       kind:'save',operationId:crypto.randomUUID(),expectedRevision:0,...draft
      },now);
      if(written.status===200)reportDraft='created';
     }
    }
   }catch{reportDraft='retry_needed';}
   const wake=await wakeLessonMediaReconciliation(env,lessonId);
   return {status:200,code:'LESSON_ENDED',lifecycle:state,reportDraft,
    mediaRevocation:wake==='sent'?'requested':'retry_pending'};
  }
  return {status:200,code:'LESSON_STARTED',lifecycle:state};
 }catch{return {status:503,code:'LIFECYCLE_UNAVAILABLE'};}
}
