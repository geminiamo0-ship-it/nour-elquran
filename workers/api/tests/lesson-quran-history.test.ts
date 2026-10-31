import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {readOwnerLessonQuranHistory} from '../src/lesson-quran-history.ts';
import type {CoreDatabase} from '../src/bindings.ts';

function fake(allowed:boolean){
 const calls:Array<{sql:string;args:unknown[]}>= [];
 const db={prepare:(sql:string)=>({bind:(...args:unknown[])=>{
  calls.push({sql,args});
  return {first:async()=>allowed?{ended_at_ms:4000}:null,
   all:async()=>{
    if(sql.includes('SELECT DISTINCT page'))return {results:[{page:1}]};
    return {results:[{item_id:'lesson-mark-001',page:1,kind:'marker',
     surah:null,ayah:null,word_index:null,actor_role:'learner',
     origin_type:'lesson',origin_id:'lesson-1',
     payload_json:JSON.stringify({color:'#0000ff',width:16,points:[{x:1,y:2},{x:3,y:4}]})}]};
   }};
 }})} as unknown as CoreDatabase;
 return {db,calls};
}

test('Notebook history denies another household before any event or page query',async()=>{
 const {db,calls}=fake(false);
 assert.deepEqual(await readOwnerLessonQuranHistory(db,'other-owner','student-1','lesson-1',1),
  {status:404,code:'NOT_FOUND'});
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0]?.args,['lesson-1','student-1','other-owner']);
 assert.ok(calls[0]?.sql.includes("l.status='completed'"));
 assert.ok(calls[0]?.sql.includes("audit.action='end'"));
});

test('historical pages originate in lesson marks, not all student pages',async()=>{
 const {db,calls}=fake(true);
 const data=await readOwnerLessonQuranHistory(db,'owner','student-1','lesson-1',null);
 assert.deepEqual(data,{status:200,code:'QURAN_LESSON_HISTORY',learnerId:'student-1',
  lessonId:'lesson-1',asOfMs:4000,pages:[1],marks:[]});
 assert.equal(calls.length,2);
 assert.ok(calls[1]?.sql.includes("origin_type='lesson'"));
 assert.ok(calls[1]?.sql.includes("audience='shared'"));
 assert.deepEqual(calls[1]?.args,['student-1','hafs-kfqc:v1.1.1','lesson-1',4000]);
});

test('as-of history reads immutable events with last event per item before End',async()=>{
 const {db,calls}=fake(true);
 const data=await readOwnerLessonQuranHistory(db,'owner','student-1','lesson-1',1);
 assert.equal(data.status,200);
 assert.ok('marks' in data);
 if(!('marks' in data))throw Error('Missing history');
 assert.equal(data.marks.length,1);
 assert.equal(data.marks[0]?.authorRole,'learner');
 assert.equal(data.marks[0]?.originType,'lesson');
 assert.equal('authorSubject' in data.marks[0]!,false);
 assert.equal(calls.length,3);
 const query=calls[2]!.sql;
 assert.ok(query.includes('learner_quran_events'));
 assert.ok(query.includes('PARTITION BY e.item_id'));
 assert.ok(query.includes('e.at_ms DESC,e.rowid DESC'));
 assert.ok(query.includes("event_rank=1 AND action='put'"));
 assert.ok(query.includes("e.audience='shared'"));
 assert.ok(!query.includes('learner_quran_current'));
 assert.ok(!query.includes('private_mushaf'));
 assert.deepEqual(calls[2]?.args,['student-1','hafs-kfqc:v1.1.1',1,4000]);
});

test('a fabricated/unmarked page is denied without reading foreign page marks',async()=>{
 const {db,calls}=fake(true);
 const out=await readOwnerLessonQuranHistory(db,'owner','student-1','lesson-1',2);
 assert.deepEqual(out,{status:400,code:'INVALID_HISTORY_PAGE'});
 assert.equal(calls.length,2);
});
