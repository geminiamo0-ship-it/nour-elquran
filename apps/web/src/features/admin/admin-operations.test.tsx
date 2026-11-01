import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminOperations} from './AdminOperations';
import {AdminActionError,submitAdminAction,validAdminAction}
 from './admin-operations-client';

const operationId='124e4567-e89b-42d3-a456-426614174000';
const reason='Verified academic action';
const teacher={action:'activate',targetUserId:'verified-account',
 operationId,reason};
const schedule={action:'cancel',resourceId:'scheduled-lesson',
 operationId,reason};
const review={appealId:'appeal-123',decision:'accepted',operationId,
 reason:'Reviewed attendance evidence'};
const respond=(status:number,body:unknown)=>
 new Response(JSON.stringify(body),{status});
afterEach(()=>vi.unstubAllGlobals());
describe('Admin operational D1 client #309',()=>{
 it('accepts only exact auditable commands without role headers or accounts',()=>{
  expect(validAdminAction('teacher',teacher)).toBe(true);
  expect(validAdminAction('schedule',schedule)).toBe(true);
  expect(validAdminAction('attendance',review)).toBe(true);
  for(const bad of [
   {...teacher,grant:'roles.manage'},
   {...teacher,targetUserId:'../../fake'},
   {...teacher,reason:'short'},
   {...teacher,operationId:'not-uuid'},
   {...teacher,action:'grant_admin'},
  ])expect(validAdminAction('teacher',bad)).toBe(false);
  expect(validAdminAction('schedule',{...schedule,kind:'standard'})).toBe(false);
  expect(validAdminAction('attendance',{...review,decision:'grant_credit'})).toBe(false);
 });
 it('requires valid future booking time, range and real IDs',()=>{
  const future=Date.now()+3600_000;
  expect(validAdminAction('schedule',{action:'assign',operationId,reason,
   learnerId:'learner-a',teacherId:'teacher-a',
   startsAtMs:future,endsAtMs:future+3600_000})).toBe(true);
  expect(validAdminAction('schedule',{action:'assign',operationId,reason,
   learnerId:'learner-a',teacherId:'teacher-a',
   startsAtMs:future,endsAtMs:future-1})).toBe(false);
  expect(validAdminAction('schedule',{action:'book',operationId,reason,
   learnerId:'learner-a',teacherId:'teacher-a',
   startsAtMs:future,kind:'premium_paid'})).toBe(false);
 });
 it('uses same-origin cookie POST and shows success only from real server ACK',async()=>{
  const mock=vi.fn().mockResolvedValue(respond(200,{code:'TEACHER_ROLE_CHANGED',
   teacherId:'teacher-1',requestId:'server-trace'}));
  vi.stubGlobal('fetch',mock);
  expect(await submitAdminAction('teacher',teacher)).toEqual({
   code:'TEACHER_ROLE_CHANGED',resourceId:'teacher-1'});
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/staff/teacher-actions');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({
   method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:{'Content-Type':'application/json'}});
  expect(JSON.parse(mock.mock.calls[0]?.[1].body)).toEqual(teacher);
  expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('authorization');
 });
 it('denies revoked roles, unknown success, and refuses fake local ACKs',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(respond(403,{code:'STAFF_ACCESS_DENIED'}))
   .mockResolvedValueOnce(respond(200,{code:'SCHEDULE_ACTION_APPLIED',resourceId:'l1'}))
   .mockResolvedValueOnce(respond(200,{code:'CREDIT_MINTED'}));
  vi.stubGlobal('fetch',mock);
  await expect(submitAdminAction('teacher',teacher)).rejects.toMatchObject({
   code:'STAFF_ACCESS_DENIED',status:403});
  expect(await submitAdminAction('schedule',schedule)).toMatchObject({
   code:'SCHEDULE_ACTION_APPLIED',resourceId:'l1'});
  await expect(submitAdminAction('attendance',review)).rejects.toMatchObject({
   code:'UNKNOWN_SERVER_SUCCESS',uncertain:true});
 });
 it('treats network interruption as uncertain rather than as a failed D1 write',async()=>{
  const mock=vi.fn().mockRejectedValue(Error('connection lost'));
  vi.stubGlobal('fetch',mock);
  await expect(submitAdminAction('teacher',teacher)).rejects.toMatchObject({
   code:'NETWORK_OUTCOME_UNKNOWN',uncertain:true});
  expect(mock).toHaveBeenCalledTimes(1);
 });
 it('does not show privileged data or actions before parent role check',()=>{
  const html=renderToStaticMarkup(<AdminOperations kind="teacher"
   session={{user:{id:'verified-staff',name:'Synthetic Staff'},phoneVerified:true}}/>);
  expect(html).toContain('إجراءات الشيوخ');
  expect(html).toContain('disabled');
  expect(html).not.toContain('تم الحفظ');
  expect(html).not.toContain('دفع');
 });
});
