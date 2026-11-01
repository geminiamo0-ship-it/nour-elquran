import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseTeacherTransition,transitionListedTeacher}
 from '../src/staff-teacher-transition.ts';
import type {CoreDatabase} from '../src/bindings.ts';
const good={teacherId:'teacher-1',action:'activate',reason:'Approved staff qualification',
 operationId:'00000000-0000-4000-8000-000000000001'};
test('roster transitions allow only four safe role operations with exact fields',()=>{
 assert.deepEqual(parseTeacherTransition(good),good);
 for(const bad of [{...good,action:'provision'},{...good,role:'admin'},
  {...good,teacherId:'../../bad'},{...good,reason:'short'},
  {...good,operationId:'not-uuid'},{...good,actor:'different'},
  {...good,reason:'  Approved staff qualification  '},null,[]])
  assert.equal(parseTeacherTransition(bad),null);
});
test('unauthorized subject sees no teacher lookup',async()=>{
 const calls:string[]=[];
 const db={prepare:(sql:string)=>{calls.push(sql);return {
  bind:()=>({first:async()=>null})};}} as unknown as CoreDatabase;
 const result=await transitionListedTeacher(db,'ordinary-owner',good);
 assert.equal(result.status,403);
 assert.equal(calls.length,1);
 assert.match(calls[0]??'',/staff_grants/);
 assert.doesNotMatch(calls[0]??'',/FROM teachers/);
});
test('server blocks a suspension with upcoming lessons before role mutation',async()=>{
 const suspend={...good,action:'suspend'};
 const calls:string[]=[];
 const db={prepare:(sql:string)=>{calls.push(sql);return {
  bind:()=>({first:async()=>sql.includes('staff_grants')?{subject:'staff'}:
   sql.includes('FROM teachers')?{subject:'teacher-subject'}:{pending:1}})};
 }} as unknown as CoreDatabase;
 const r=await transitionListedTeacher(db,'staff',suspend,1793500000000);
 assert.deepEqual(r,{status:409,code:'ACTIVE_CLASSES_BLOCK_TRANSITION'});
 assert.equal(calls.length,3);
 assert.doesNotMatch(calls.join('\n'),/INSERT INTO teacher_role_events/);
});
