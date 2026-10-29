import {describe,it,expect} from 'vitest';
import {assignmentAttemptClient,parseAttempts} from './assignment-attempt-client';
const id='48f455f7-65cf-4904-9bc3-fdfb7ba2f620';
const attempt={id,attempt:1,note:'I have revised',submittedAtMs:1800000000000,
 decision:null,feedback:null,reviewedAtMs:null};
describe('verified teacher/student D1 attempt client',()=>{
 it('rejects broken attempt response and preserves sent/read status',()=>{
   expect(parseAttempts([attempt])).toHaveLength(1);
   expect(()=>parseAttempts([{...attempt,decision:'secret'}])).toThrow();
   expect(()=>parseAttempts([{...attempt,id:'../../other'}])).toThrow();
   expect(()=>parseAttempts([attempt,attempt])).toThrow();
   expect(()=>parseAttempts(null)).toThrow();
 });
 it('uses same-origin credentials, strict ACK and correct owner/teacher routes',async()=>{
  const calls:Array<{url:string;init?:RequestInit}>=[];
  const api=assignmentAttemptClient(async(input,init)=>{
   calls.push({url:String(input),init});
   return init?.method==='POST'?
     Response.json(String(input).includes('/reviews')?{code:'REVIEW_SAVED',reviewId:id}:
       {code:'SUBMISSION_SENT',submissionId:id},{status:201}):
     Response.json({attempts:[attempt]});
  });
  expect(await api.studentAttempts(id,id)).toHaveLength(1);
  expect(await api.teacherAttempts(id,id)).toHaveLength(1);
  expect(await api.submit(id,id,'note',id)).toBe(id);
  expect(await api.review(id,id,id,'retry_requested','try again',id)).toBe(id);
  expect(calls.map(x=>x.url)).toEqual([
    '/v1/me/learners/'+id+'/assignments/'+id+'/submissions',
    '/v1/teacher/learners/'+id+'/assignments/'+id+'/reviews',
    '/v1/me/learners/'+id+'/assignments/'+id+'/submissions',
    '/v1/teacher/learners/'+id+'/assignments/'+id+'/reviews']);
  expect(calls[3]?.init).toMatchObject({credentials:'same-origin',method:'POST'});
  await expect(api.studentAttempts('../../other',id)).rejects.toMatchObject({code:'INVALID_ID'});
 });
 it('never reports success without a verified server receipt',async()=>{
   const api=assignmentAttemptClient(async()=>Response.json({code:'SUBMISSION_SENT'},{status:201}));
   await expect(api.submit(id,id,'text',id)).rejects.toMatchObject({code:'INVALID_RESPONSE'});
 });
});
