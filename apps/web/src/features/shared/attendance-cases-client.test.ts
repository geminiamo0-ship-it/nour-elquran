import {afterEach,describe,expect,it,vi} from 'vitest';
import {attendanceClient,parseAttendanceCases} from './attendance-cases-client';

const owner={incidentId:'6145a6fa-1d94-4994-91e7-5819692ba3b6',
 lessonId:'lesson-a',kind:'student_no_show',reason:'Preliminary report',
 reportedAtMs:1800000000000,appealId:null,appealedAtMs:null,
 decision:null,decisionReason:null,decidedAtMs:null};
const teacher={incidentId:owner.incidentId,lessonId:owner.lessonId,learnerId:'child-a',
 kind:owner.kind,reason:owner.reason,reportedAtMs:owner.reportedAtMs};
const json=(status:number,value:unknown)=>
 new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
afterEach(()=>vi.unstubAllGlobals());
describe('signed teacher + owner attendance boundary',()=>{
 it('validates strict source records and required nullable appeal fields',()=>{
  expect(parseAttendanceCases({code:'ATTENDANCE_CASES',incidents:[owner]},'owner'))
   .toEqual([owner]);
  expect(parseAttendanceCases({code:'ATTENDANCE_CASES',incidents:[teacher]},'teacher'))
   .toEqual([teacher]);
  for(const bad of [
   {...owner,incidentId:'fake'}, {...owner,appealId:'forged'},
   {...owner,reportedAtMs:'yesterday'}, {...owner,decision:'charged'},
   {...owner,appealedAtMs:undefined}
  ])expect(()=>parseAttendanceCases({code:'ATTENDANCE_CASES',incidents:[bad]},'owner')).toThrow();
 });
 it('teacher POST includes only reason, kind and idempotency, never actor or presence',async()=>{
  const spy=vi.fn().mockResolvedValue(json(201,
    {code:'ATTENDANCE_REPORT_RECORDED',incidentId:owner.incidentId}));
  vi.stubGlobal('fetch',spy);
  expect(await attendanceClient.report('lesson-a','student_no_show',
   'Learner was not present during the 15-minute waiting window.',
   '2145a6fa-1d94-4994-91e7-5819692ba3b6')).toBe(owner.incidentId);
  expect(spy.mock.calls[0]?.[0]).toBe('/v1/teacher/lessons/lesson-a/attendance-report');
  expect(spy.mock.calls[0]?.[1]).toMatchObject({method:'POST',cache:'no-store',
   credentials:'same-origin',redirect:'error'});
  expect(JSON.parse(spy.mock.calls[0]?.[1]?.body)).toEqual({
   operationId:'2145a6fa-1d94-4994-91e7-5819692ba3b6',
   kind:'student_no_show',reason:'Learner was not present during the 15-minute waiting window.'});
 });
 it('owner appeal posts only for exact learner and incidental ID; rejects sibling URL traversal',async()=>{
  const spy=vi.fn().mockResolvedValue(json(201,
   {code:'ATTENDANCE_APPEAL_SUBMITTED',appealId:'3145a6fa-1d94-4994-91e7-5819692ba3b6'}));
  vi.stubGlobal('fetch',spy);
  expect(await attendanceClient.appeal('child-a',owner.incidentId,
   'We were in the lesson waiting room before the scheduled start.',
   '4145a6fa-1d94-4994-91e7-5819692ba3b6'))
   .toBe('3145a6fa-1d94-4994-91e7-5819692ba3b6');
  expect(spy.mock.calls[0]?.[0]).toBe('/v1/me/learners/child-a/attendance-appeals');
  expect(JSON.parse(spy.mock.calls[0]?.[1]?.body)).toEqual({
   incidentId:owner.incidentId,reason:'We were in the lesson waiting room before the scheduled start.',
   operationId:'4145a6fa-1d94-4994-91e7-5819692ba3b6'});
  await expect(attendanceClient.ownerCases('../other')).rejects.toThrow('INVALID_LEARNER');
 });
 it('409 or malformed ACK never becomes a client success',async()=>{
  const spy=vi.fn().mockResolvedValueOnce(json(409,{code:'NO_SHOW_NOT_ELIGIBLE'}))
   .mockResolvedValueOnce(json(201,{code:'ATTENDANCE_REPORT_RECORDED',incidentId:'bad'}));
  vi.stubGlobal('fetch',spy);
  const args=['lesson-a','student_no_show','Learner was not present.',
   '2145a6fa-1d94-4994-91e7-5819692ba3b6'] as const;
  await expect(attendanceClient.report(...args)).rejects.toThrow('NO_SHOW_NOT_ELIGIBLE');
  await expect(attendanceClient.report(...args)).rejects.toThrow('INVALID_ATTENDANCE_RESPONSE');
 });
 it('source-only read routes never send actor or optional private evidence',async()=>{
  const spy=vi.fn().mockResolvedValueOnce(json(200,{code:'ATTENDANCE_CASES',incidents:[owner]}))
   .mockResolvedValueOnce(json(200,{code:'ATTENDANCE_CASES',incidents:[teacher]}));
  vi.stubGlobal('fetch',spy);
  expect(await attendanceClient.ownerCases('child-a')).toEqual([owner]);
  expect(await attendanceClient.teacherCases()).toEqual([teacher]);
  expect(spy.mock.calls.map((call:unknown[])=>call[0])).toEqual([
   '/v1/me/learners/child-a/attendance-cases','/v1/teacher/attendance-cases']);
 });
});
