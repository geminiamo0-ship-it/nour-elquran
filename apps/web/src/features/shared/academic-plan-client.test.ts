import {describe,expect,it} from 'vitest';
import {academicPlanClient,parseAcademicPlan,PlanClientError} from './academic-plan-client';
const learner='48f455f7-65cf-4904-9bc3-fdfb7ba2f620';
const plan={level:'beginner',nextWird:'الفاتحة',revisionWird:'مراجعة',focus:'النطق',revision:1,updatedAtMs:1000};
describe('academic plan client',()=>{
 it('parses only fully typed teacher-authored plans',()=>{
  expect(parseAcademicPlan(plan)).toEqual(plan);
  expect(parseAcademicPlan(null)).toBeNull();
  expect(()=>parseAcademicPlan({...plan,revision:0})).toThrow(PlanClientError);
  expect(()=>parseAcademicPlan({...plan,focus:null})).toThrow(PlanClientError);
  expect(()=>parseAcademicPlan({...plan,nextWird:''})).toThrow(PlanClientError);
 });
 it('reads only same-origin fixed routes with credentials and no cache',async()=>{
  const calls: Array<{url:string,opts?:RequestInit}>=[];
  const api=academicPlanClient(async(input,opts)=>{
   calls.push({url:String(input),opts});
   return Response.json({plan});
  });
  await expect(api.ownerPlan(learner)).resolves.toEqual(plan);
  await expect(api.teacherPlan(learner)).resolves.toEqual(plan);
  expect(calls.map(c=>c.url)).toEqual([
   '/v1/me/learners/'+learner+'/plan',
   '/v1/teacher/learners/'+learner+'/plan',
  ]);
  expect(calls[0]?.opts).toMatchObject({method:'GET',credentials:'same-origin',cache:'no-store'});
 });
 it('saves with expectedRevision UUID and requires matching server acknowledgement',async()=>{
  const calls:Array<{url:string,opts?:RequestInit}>=[];
  const api=academicPlanClient(async(input,opts)=>{
   calls.push({url:String(input),opts});
   return Response.json({code:'PLAN_SAVED',revision:2});
  });
  const operationId='6ae0d302-555e-4ff9-a9f2-d0b1b70b9ebf';
  await expect(api.save(learner,plan,1,operationId)).resolves.toBe(2);
  expect(calls[0]?.opts).toMatchObject({method:'POST',credentials:'same-origin'});
  expect(JSON.parse(String(calls[0]?.opts?.body))).toEqual({
   level:plan.level,nextWird:plan.nextWird,revisionWird:plan.revisionWird,
   focus:plan.focus,expectedRevision:1,operationId,
   revision:1,updatedAtMs:1000,
  });
  await expect(api.save('../leak',plan,1,operationId)).rejects.toMatchObject({code:'INVALID_LEARNER_ID'});
  expect(calls).toHaveLength(1);
 });
 it('never claims success on wrong revision, missing API or network failure',async()=>{
  const bad=academicPlanClient(async()=>Response.json({code:'PLAN_SAVED',revision:5}));
  await expect(bad.save(learner,plan,0,'key')).rejects.toMatchObject({code:'INVALID_RESPONSE'});
  const denied=academicPlanClient(async()=>Response.json({code:'NOT_FOUND'},{status:404}));
  await expect(denied.ownerPlan(learner)).rejects.toMatchObject({status:404});
  const disconnected=academicPlanClient(async()=>{throw new Error('offline');});
  await expect(disconnected.ownerPlan(learner)).rejects.toMatchObject({code:'NETWORK_ERROR'});
 });
});
