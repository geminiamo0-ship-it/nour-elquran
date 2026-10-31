import {afterEach,describe,expect,it,vi} from 'vitest';
import {inboxClient,parseInboxItems} from './connected-inbox-client';
const item={id:'a'.repeat(32),learnerId:'child-a',kind:'lesson_booked',
 sourceId:'lesson-1',title:'حصة مؤكدة',detail:'حصة جديدة',
 createdAtMs:1799990000000,read:false,revision:0};
const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status});
afterEach(()=>vi.unstubAllGlobals());
describe('signed inbox client',()=>{
 it('parses bounded real records and rejects malformed reader metadata',()=>{
  expect(parseInboxItems([item])).toEqual([item]);
  expect(()=>parseInboxItems([{...item,revision:'0'}])).toThrow();
  expect(()=>parseInboxItems([{...item,id:'injected'}])).toThrow();
  expect(()=>parseInboxItems([{...item,read:'false'}])).toThrow();
 });
 it('teacher GET is same-origin, cache disabled, no user-supplied identity',async()=>{
  const mocked=vi.fn().mockResolvedValue(respond(200,{code:'INBOX',items:[item]}));
  vi.stubGlobal('fetch',mocked);
  expect(await inboxClient().teacher()).toEqual([item]);
  expect(mocked.mock.calls[0]?.[0]).toBe('/v1/teacher/inbox');
  expect(mocked.mock.calls[0]?.[1]).toMatchObject({
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'});
 });
 it('owner GET only asks exact profile; sibling source is not client-controlled',async()=>{
  const mocked=vi.fn().mockResolvedValue(respond(200,{code:'INBOX',items:[]}));
  vi.stubGlobal('fetch',mocked);
  expect(await inboxClient().owner('child-a')).toEqual([]);
  expect(mocked.mock.calls[0]?.[0]).toBe('/v1/me/learners/child-a/inbox');
  await expect(inboxClient().owner('../other')).rejects.toThrow('INVALID_LEARNER');
 });
 it('read ACK is server committed and sends only immutable item, revision and UUID',async()=>{
  const mocked=vi.fn().mockResolvedValue(respond(200,
   {code:'INBOX_UPDATED',read:true,revision:1}));
  vi.stubGlobal('fetch',mocked);
  const updated=await inboxClient().mark('teacher',null,item,true,
   '2145a6fa-1d94-4994-91e7-5819692ba3b6');
  expect(updated).toEqual({...item,read:true,revision:1});
  const body=JSON.parse(String(mocked.mock.calls[0]?.[1]?.body));
  expect(body).toEqual({notificationId:item.id,operationId:'2145a6fa-1d94-4994-91e7-5819692ba3b6',
   action:'read',expectedRevision:0});
  expect(body).not.toHaveProperty('actorSubject');
 });
 it('rejected and malformed mutation results never optimistic update',async()=>{
  const mocked=vi.fn().mockResolvedValueOnce(respond(409,{code:'INBOX_REVISION_CONFLICT'}))
   .mockResolvedValueOnce(respond(200,{code:'INBOX_UPDATED',revision:1,read:false}));
  vi.stubGlobal('fetch',mocked);
  await expect(inboxClient().mark('teacher',null,item,true,'2145a6fa-1d94-4994-91e7-5819692ba3b6'))
   .rejects.toThrow('INBOX_REVISION_CONFLICT');
  await expect(inboxClient().mark('teacher',null,item,true,'3145a6fa-1d94-4994-91e7-5819692ba3b6'))
   .rejects.toThrow('INVALID_INBOX_RESPONSE');
 });
});
