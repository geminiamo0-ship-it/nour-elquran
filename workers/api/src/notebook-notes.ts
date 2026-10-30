import type {CoreDatabase} from './bindings.ts';

export type NotebookAction=Readonly<{
 action:'put'|'hide';operationId:string;noteId:string;expectedVersion:number;body:string;
}>;
type NoteRow={id:string;body:string;version:number;updated_at_ms:number};
type EventRow={actor_auth_subject:string;learner_id:string;lesson_id:string;
 id:string;action:'put'|'hide';expected_version:number;body:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseNotebookAction(raw:unknown):NotebookAction|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const v=raw as Record<string,unknown>,keys=['action','operationId','noteId','expectedVersion','body'];
 if(Object.keys(v).length!==keys.length||!keys.every(k=>k in v)||
   (v.action!=='put'&&v.action!=='hide')||
   typeof v.operationId!=='string'||!uuid.test(v.operationId)||
   typeof v.noteId!=='string'||!uuid.test(v.noteId)||
   !Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<0||
   typeof v.body!=='string'||v.body.length>500||
   Array.from(v.body).some(ch=>{const n=ch.charCodeAt(0);return n<32&&n!==9&&n!==10&&n!==13;})||
   (v.action==='put'&&!v.body.trim())||
   (v.action==='hide'&&(v.body!==''||Number(v.expectedVersion)===0)))return null;
 return {action:v.action,operationId:v.operationId,noteId:v.noteId,
   expectedVersion:v.expectedVersion as number,body:v.action==='put'?v.body.trim():''};
}
const ownerLessonSQL=[
 'SELECT 1 AS permitted FROM lessons l JOIN learners student ON student.id=l.learner_id',
 'JOIN accounts owner ON owner.id=student.account_id',
 "WHERE l.id=? AND l.learner_id=? AND student.status='active' AND owner.status='active'",
 "AND owner.auth_subject=? AND l.status='completed' AND l.ended_at_ms IS NOT NULL",
 'AND l.ended_at_ms<=?',
 "AND EXISTS (SELECT 1 FROM lesson_lifecycle_events e WHERE e.lesson_id=l.id AND e.action='end'",
 'AND e.teacher_id=l.actual_teacher_id AND e.at_ms=l.ended_at_ms) LIMIT 1'
].join(' ');
async function allowed(db:CoreDatabase,actor:string,learnerId:string,lessonId:string,now:number){
 const found=await db.prepare(ownerLessonSQL).bind(lessonId,learnerId,actor,now)
  .first<{permitted:number}>();
 return found?.permitted===1;
}
export async function readNotebookNotes(db:CoreDatabase,actor:string,
 learnerId:string,lessonId:string,now=Date.now()){
 if(!await allowed(db,actor,learnerId,lessonId,now))return {status:404,code:'NOT_FOUND'} as const;
 const rows=await db.prepare([
  'SELECT id,body,version,updated_at_ms FROM notebook_private_notes',
  'WHERE learner_id=? AND lesson_id=? AND visible=1',
  'ORDER BY updated_at_ms DESC,id DESC LIMIT 100'
 ].join(' ')).bind(learnerId,lessonId).all<NoteRow>();
 return {status:200,notes:rows.results.map(n=>({
  id:n.id,body:n.body,version:n.version,updatedAtMs:n.updated_at_ms
 }))} as const;
}
export async function writeNotebookNote(db:CoreDatabase,actor:string,
 learnerId:string,lessonId:string,action:NotebookAction,now=Date.now()){
 // Every replay, including a successful historical operation, checks current ownership.
 if(!await allowed(db,actor,learnerId,lessonId,now))return {status:404,code:'NOT_FOUND'} as const;
 const prior=()=>db.prepare([
  'SELECT actor_auth_subject,learner_id,lesson_id,id,action,expected_version,body',
  'FROM notebook_note_events WHERE operation_id=?'
 ].join(' ')).bind(action.operationId).first<EventRow>();
 const replay=(e:EventRow)=>{
  if(e.actor_auth_subject!==actor||e.learner_id!==learnerId||e.lesson_id!==lessonId)
   return {status:404,code:'NOT_FOUND'} as const;
  if(e.id!==action.noteId||e.action!==action.action||
    e.expected_version!==action.expectedVersion||e.body!==action.body)
   return {status:409,code:'NOTEBOOK_OPERATION_CONFLICT'} as const;
  return {status:200,code:'NOTEBOOK_ALREADY_APPLIED',noteId:action.noteId,
   version:action.expectedVersion+1} as const;
 };
 const before=await prior();if(before)return replay(before);
 try{
  await db.prepare([
   'INSERT INTO notebook_note_events(operation_id,id,learner_id,lesson_id,actor_auth_subject,',
   'action,expected_version,body,at_ms) VALUES(?,?,?,?,?,?,?,?,?)'
  ].join(' ')).bind(action.operationId,action.noteId,learnerId,lessonId,
   actor,action.action,action.expectedVersion,action.body,now).run();
 }catch(e){
  const saved=await prior();if(saved)return replay(saved);
  if(e instanceof Error){
   if(e.message.includes('NOTEBOOK_ACCESS_DENIED'))return {status:404,code:'NOT_FOUND'} as const;
   if(e.message.includes('NOTEBOOK_VERSION_CONFLICT')||e.message.includes('NOTEBOOK_NOTE_LIMIT')||
      e.message.includes('UNIQUE constraint'))return {status:409,code:'NOTEBOOK_VERSION_CONFLICT'} as const;
   if(e.message.includes('NOTEBOOK_BAD_BODY'))return {status:400,code:'INVALID_NOTEBOOK_ACTION'} as const;
  }
  throw e;
 }
 return {status:action.action==='put'&&action.expectedVersion===0?201:200,
  code:action.action==='hide'?'NOTEBOOK_NOTE_HIDDEN':'NOTEBOOK_NOTE_SAVED',
  noteId:action.noteId,version:action.expectedVersion+1} as const;
}
