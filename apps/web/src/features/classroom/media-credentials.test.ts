import {afterEach,describe,expect,it,vi} from 'vitest';
import {JoinError,mediaTokenPath,parseJoinTicket,requestMediaTicket} from './media-credentials';

const student={role:'learner' as const,lessonId:'lesson-abc',learnerId:'learner-xyz'};
const teacher={role:'teacher' as const,lessonId:'lesson-abc'};
const jwt='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln';
const ticket={code:'MEDIA_TOKEN_ISSUED',serverUrl:'wss://synthetic.livekit.cloud',
  participantToken:jwt,expiresInSeconds:120};
afterEach(()=>vi.unstubAllGlobals());
describe('LiveKit browser ticket security boundary',()=>{
 it('never accepts user-supplied grants, separate account route per signed role',()=>{
  expect(mediaTokenPath(student)).toBe(
   '/v1/me/learners/learner-xyz/lessons/lesson-abc/media-token');
  expect(mediaTokenPath(teacher)).toBe('/v1/teacher/lessons/lesson-abc/media-token');
  expect(()=>mediaTokenPath({...student,lessonId:'../admin'})).toThrow();
  expect(()=>mediaTokenPath({...student,learnerId:'other?room=all'})).toThrow();
  expect(()=>mediaTokenPath({role:'teacher',lessonId:'abc',learnerId:'forged'})).toThrow();
 });
 it('accepts only a short WSS Cloud ticket with expected server-issued payload',()=>{
  expect(parseJoinTicket(ticket)).toEqual({
   serverUrl:ticket.serverUrl,participantToken:jwt,expiresInSeconds:120});
  for(const bad of [
   {...ticket,code:'ROOM_ADMIN'},{...ticket,expiresInSeconds:3600},
   {...ticket,participantToken:'bad.token'},{...ticket,participantToken:''},
   {...ticket,serverUrl:'ws://synthetic.livekit.cloud'},
   {...ticket,serverUrl:'wss://synthetic.livekit.cloud.evil.net'},
   {...ticket,serverUrl:'wss://synthetic.livekit.cloud/path'},
   {...ticket,serverUrl:'wss://synthetic.livekit.cloud?api=secret'},
   {...ticket,serverUrl:'wss://localhost:7880'},
   null,[],{},
  ])expect(()=>parseJoinTicket(bad)).toThrow(JoinError);
 });
 it('POST is same origin, empty body, no-store, redirect denied; malformed never exposes credentials',async()=>{
  const f=vi.fn().mockResolvedValue({ok:true,json:async()=>ticket});
  vi.stubGlobal('fetch',f);
  const t=await requestMediaTicket(student);
  expect(t.participantToken).toBe(jwt);
  expect(f).toHaveBeenCalledTimes(1);
  const [url,options]=f.mock.calls[0]!;
  expect(url).toBe(mediaTokenPath(student));
  expect(options).toMatchObject({method:'POST',body:'{}',credentials:'same-origin',
   cache:'no-store',redirect:'error'});
  expect(JSON.stringify(options)).not.toContain('learner-xyz');
 });
 it('Dev unconfigured or auth denial never returns a ticket',async()=>{
  for(const status of [503,401,403,404,409,500]){
   const f=vi.fn().mockResolvedValue({ok:false,status,json:async()=>({
    code:'LIVEKIT_NOT_CONFIGURED',participantToken:jwt,
   })});
   vi.stubGlobal('fetch',f);
   await expect(requestMediaTicket(teacher)).rejects.toThrow(JoinError);
  }
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
  await expect(requestMediaTicket(student)).rejects.toMatchObject({code:'NETWORK'});
 });
});
