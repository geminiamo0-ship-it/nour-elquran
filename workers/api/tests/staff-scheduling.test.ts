import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseScheduleCommand,executeStaffSchedule,
  SCHEDULE_EVENT_LOOKUP_SQL,SCHEDULE_EVENT_INSERT_SQL} from '../src/staff-scheduling.ts';
import type {CoreDatabase} from '../src/bindings.ts';
const now=1_800_000_000_000;
const operationId='00000000-0000-4000-8000-000000000001';
const base={action:'assign',operationId,reason:'Approved learner assignment',
  learnerId:'learner-a',teacherId:'teacher-a',startsAtMs:now+1000,endsAtMs:now+10_000_000};
test('exact strict action schema with 40m book and no actor/role fields',()=>{
 assert.deepEqual(parseScheduleCommand(base,now),base);
 for(const invalid of [
  {...base,actor:'staff'}, {...base,role:'staff'}, {...base,endsAtMs:base.startsAtMs},
  {...base,learnerId:'evil" OR 1=1'}, {...base,reason:'bad'}, {...base,operationId:'forged'},
  {...base,startsAtMs:now-1}, {...base,endsAtMs:now+3*366*86400000},
  {...base,teacherId:17},[],null,
 ])assert.equal(parseScheduleCommand(invalid,now),null);
 assert.deepEqual(parseScheduleCommand({action:'book',operationId,reason:base.reason,
  learnerId:'learner-a',teacherId:'teacher-a',startsAtMs:now+1000,kind:'trial'},now),
  {action:'book',operationId,reason:base.reason,learnerId:'learner-a',teacherId:'teacher-a',
    startsAtMs:now+1000,endsAtMs:now+1000+2_400_000,kind:'trial'});
 for(const action of ['cancel','revoke']) {
  assert.deepEqual(parseScheduleCommand({action,operationId,reason:base.reason,resourceId:'lesson-a'},now),
    {action,operationId,reason:base.reason,resourceId:'lesson-a'});
 }
});
test('non-staff cannot touch scheduling database beyond grant check',async()=>{
 const calls:string[]=[];
 const db={prepare:(sql:string)=>{calls.push(sql);return {bind:()=>({first:async()=>null})};}} as unknown as CoreDatabase;
 assert.deepEqual(await executeStaffSchedule(db,'forged-admin',base,now),
  {status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(calls.length,1);
 assert.doesNotMatch(calls[0]??'',/staff_schedule_events/);
});
test('verified staff writes only bound fields to atomic immutable D1 event',async()=>{
 const calls:Array<{query:string;values:unknown[]}=[];
 const db={prepare:(query:string)=>({bind:(...values:unknown[])=>{
   calls.push({query,values});return {
     first:async()=>query.includes('staff_grants')?{subject:'staff'}:null,
     run:async()=>({success:true,meta:{changes:1}}),
   };
 }})} as unknown as CoreDatabase;
 const res=await executeStaffSchedule(db,'staff',base,now);
 assert.equal(res.status,201);
 assert.equal(calls[1]?.query,SCHEDULE_EVENT_LOOKUP_SQL);
 assert.equal(calls[2]?.query,SCHEDULE_EVENT_INSERT_SQL);
 assert.deepEqual(calls[2]?.values.slice(1,5),[operationId,'staff','assign',res.resourceId]);
 assert.deepEqual(calls[2]?.values.slice(5),['learner-a','teacher-a',
   base.startsAtMs,base.endsAtMs,null,base.reason,now]);
});
test('idempotent replay requires matching actor, payload, and action',async()=>{
 const db={prepare:(query:string)=>({bind:()=>({
   first:async()=>query.includes('staff_grants')?{subject:'staff'}:{
     actor:'staff',action:'assign',resourceId:'assignment-old',learnerId:'learner-a',
     teacherId:'teacher-a',startsAtMs:base.startsAtMs,endsAtMs:base.endsAtMs,
     kind:null,reason:base.reason},
 })})} as unknown as CoreDatabase;
 assert.deepEqual(await executeStaffSchedule(db,'staff',base,now),
   {status:200,code:'OPERATION_ALREADY_APPLIED',resourceId:'assignment-old',action:'assign'});
 assert.equal((await executeStaffSchedule(db,'staff',{...base,reason:'Different purpose'},now)).status,409);
});
