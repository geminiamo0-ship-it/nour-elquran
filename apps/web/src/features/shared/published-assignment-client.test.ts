import {describe,it,expect} from 'vitest';
import {assignmentClient,parsePublishedTasks} from './published-assignment-client';
const id='48f455f7-65cf-4904-9bc3-fdfb7ba2f620';
const task={id,learnerId:id,kind:'memorization',editionId:'hafs-kfqc:v1.1.1',
 surah:1,fromAyah:1,toAyah:7,startPage:1,endPage:1,
 dueAtMs:1780000000000,publishedAtMs:1779990000000,
 instructions:'Review',status:'assigned',revision:1};
describe('live student assignment contract',()=>{
 it('rejects forged/malformed learner task and empty response only if truly empty',()=>{
  expect(parsePublishedTasks([task])).toHaveLength(1);
  expect(parsePublishedTasks([])).toEqual([]);
  expect(()=>parsePublishedTasks([{...task,surah:115}])).toThrow();
  expect(()=>parsePublishedTasks([{...task,kind:['memorization']}])).toThrow();
  expect(()=>parsePublishedTasks([{...task,endPage:0}])).toThrow();
  expect(()=>parsePublishedTasks(null)).toThrow();
 });
 it('uses only same-origin owner/teacher HTTP and requires server publish ACK',async()=>{
  const calls:Array<{url:string,init?:RequestInit}>=[];
  const api=assignmentClient(async(url,init)=>{
   calls.push({url:String(url),init});
   if(String(url).endsWith('/assignment-catalog'))return Response.json({surahs:[{editionId:task.editionId,surah:1,ayahCount:7}]});
   if(init?.method==='POST')return Response.json({code:'ASSIGNMENT_PUBLISHED',assignmentId:id},{status:201});
   return Response.json({assignments:[task]});
  });
  await expect(api.owner(id)).resolves.toHaveLength(1);
  await expect(api.teacher(id)).resolves.toHaveLength(1);
  await expect(api.catalog()).resolves.toHaveLength(1);
  await expect(api.publish(id,{kind:'memorization',editionId:task.editionId,
    surah:1,fromAyah:1,toAyah:7,dueAtMs:task.dueAtMs,instructions:'Review'},id)).resolves.toBe(id);
  expect(calls.map(c=>c.url)).toEqual([
   '/v1/me/learners/'+id+'/assignments',
   '/v1/teacher/learners/'+id+'/assignments',
   '/v1/teacher/assignment-catalog',
   '/v1/teacher/learners/'+id+'/assignments']);
  expect(calls[3]?.init).toMatchObject({credentials:'same-origin',method:'POST'});
  await expect(api.owner('../escape')).rejects.toMatchObject({code:'INVALID_LEARNER_ID'});
 });
 it('does not confirm a save when server replies without an assignment ID',async()=>{
  const api=assignmentClient(async()=>Response.json({code:'ASSIGNMENT_PUBLISHED'},{status:201}));
  await expect(api.publish(id,{kind:'revision',editionId:task.editionId,
    surah:1,fromAyah:1,toAyah:7,dueAtMs:task.dueAtMs,instructions:'Review'},id))
   .rejects.toMatchObject({code:'INVALID_RESPONSE'});
 });
});
