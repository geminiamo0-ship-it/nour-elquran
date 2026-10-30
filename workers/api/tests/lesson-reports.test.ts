import {strict as assert} from 'node:assert';
import {DatabaseSync} from 'node:sqlite';
import type {CoreDatabase} from '../src/bindings.ts';
import {test} from 'node:test';
import {getTeacherReport,parseReportAction} from '../src/lesson-reports.ts';
const id='0996d89e-1e5b-4d33-9abe-79f255f553eb';
const draft={kind:'save',operationId:id,expectedRevision:0,scope:' الفاتحة ',
 strengths:'جيد',corrections:'',nextPlan:'مراجعة',
 memorization:0,recitation:10,tajweed:null};
test('three independent scores preserve zero and null',()=>{
 assert.deepEqual(parseReportAction(draft),{...draft,scope:'الفاتحة'});
 assert.deepEqual(parseReportAction({...draft,memorization:null,recitation:null}),{
  ...draft,scope:'الفاتحة',memorization:null,recitation:null});
});
test('reject any actor injection, coerced fields, malformed grades or publication payload',()=>{
 for(const value of [{...draft,teacherId:'forged'}, {...draft,memorization:11},
  {...draft,memorization:-1},{...draft,recitation:2.5},{...draft,recitation:'7'},
  {...draft,tajweed:undefined},{...draft,expectedRevision:0.5},
  {...draft,expectedRevision:'0'},{...draft,scope:'x'.repeat(701)},
  {...draft,scope:'hello\u0000'}, {...draft,operationId:['not-an-id']},
  {...draft,kind:'publish'}, {},[],null])
  assert.equal(parseReportAction(value),null,JSON.stringify(value));
 assert.deepEqual(parseReportAction({kind:'publish',operationId:id,expectedRevision:2}),
  {kind:'publish',operationId:id,expectedRevision:2});
});


test('Sheikh report GET requires the same accepted substitute scope as the D1 write guard',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 try{
  // Minimal synthetic schema: exercise the actual Worker SQL, not a mocked permission flag.
  sqlite.exec(`
   CREATE TABLE accounts(id TEXT PRIMARY KEY,status TEXT);
   CREATE TABLE learners(id TEXT PRIMARY KEY,account_id TEXT,status TEXT);
   CREATE TABLE teachers(id TEXT PRIMARY KEY,auth_subject TEXT,status TEXT,qualified INTEGER);
   CREATE TABLE lessons(id TEXT PRIMARY KEY,learner_id TEXT,actual_teacher_id TEXT,
     status TEXT,starts_at_ms INTEGER,ends_at_ms INTEGER,ended_at_ms INTEGER);
   CREATE TABLE lesson_lifecycle_events(lesson_id TEXT,teacher_id TEXT,action TEXT,at_ms INTEGER);
   CREATE TABLE teacher_assignments(learner_id TEXT,teacher_id TEXT,revoked_at_ms INTEGER,
     starts_at_ms INTEGER,ends_at_ms INTEGER);
   CREATE TABLE lesson_access_grants(lesson_id TEXT,learner_id TEXT,teacher_id TEXT,
     kind TEXT,accepted_at_ms INTEGER,consent_deadline_ms INTEGER,revoked_at_ms INTEGER,
     starts_at_ms INTEGER,ends_at_ms INTEGER);
   CREATE TABLE lesson_report_publications(lesson_id TEXT,published_at_ms INTEGER);
   CREATE TABLE lesson_report_state(lesson_id TEXT,learner_id TEXT,revision INTEGER,
     status TEXT,latest_published_revision INTEGER,scope TEXT,strengths TEXT,
     corrections TEXT,next_plan TEXT,memorization INTEGER,recitation INTEGER,
     tajweed INTEGER,updated_at_ms INTEGER);
   INSERT INTO accounts VALUES('owner','active');
   INSERT INTO learners VALUES('learner','owner','active');
   INSERT INTO teachers VALUES('teacher','sheikh','active',1);
   INSERT INTO lessons VALUES('lesson','learner','teacher','completed',1000,2401000,3000);
   INSERT INTO lesson_lifecycle_events VALUES('lesson','teacher','end',3000);
   INSERT INTO lesson_report_state VALUES('lesson','learner',1,'draft',NULL,
     'synthetic scope','','','',NULL,NULL,NULL,3100);
   INSERT INTO lesson_access_grants VALUES('lesson','learner','teacher','substitute',
     900,950,NULL,1000,2401000);
  `);
  const db:CoreDatabase={
   prepare(sql:string){
    let values:(string|number|null)[]=[];
    return {
     bind(...args:unknown[]){values=args as (string|number|null)[];return this;},
     async first<T>(){return (sqlite.prepare(sql).get(...values) as T|undefined)??null;},
     async all<T>(){return {results:sqlite.prepare(sql).all(...values) as T[]};},
     async run(){const result=sqlite.prepare(sql).run(...values);
      return {success:true,meta:{changes:Number(result.changes)}};}
    };
   }
  };
  const read=()=>getTeacherReport(db,'sheikh','lesson',3100);
  assert.equal((await read()).status,200,'valid accepted substitute can read own lesson draft');
  const invalid=[
   ['acceptance after lesson start',"accepted_at_ms=1100"],
   ['acceptance after consent deadline',"accepted_at_ms=980"],
   ['missing consent deadline',"consent_deadline_ms=NULL"],
   ['grant starts after lesson',"starts_at_ms=1001"],
   ['grant ends before lesson',"ends_at_ms=2400999"],
   ['grant for a different learner',"learner_id='foreign'"],
   ['missing acceptance',"accepted_at_ms=NULL"],
   ['revoked grant',"revoked_at_ms=3050"]
  ] as const;
  for(const [reason,change] of invalid){
   sqlite.exec('SAVEPOINT invalid_grant');
   sqlite.exec('UPDATE lesson_access_grants SET '+change);
   assert.equal((await read()).status,404,reason);
   sqlite.exec('ROLLBACK TO invalid_grant');
   sqlite.exec('RELEASE invalid_grant');
  }
  // Once the first publication's 24-hour correction window ends, GET is denied too.
  sqlite.exec("INSERT INTO lesson_report_publications VALUES('lesson',3200)");
  assert.equal((await getTeacherReport(db,'sheikh','lesson',3200+86400001)).status,404);
  sqlite.exec("DELETE FROM lesson_report_publications");
  sqlite.exec("DELETE FROM lesson_access_grants");
  sqlite.exec("INSERT INTO teacher_assignments VALUES('learner','teacher',NULL,0,3000000)");
  assert.equal((await read()).status,200,'valid historical primary assignment remains allowed');
  sqlite.exec("UPDATE teacher_assignments SET revoked_at_ms=3000");
  assert.equal((await read()).status,404,'revoked primary teacher cannot read draft');
 }finally{sqlite.close();}
});
