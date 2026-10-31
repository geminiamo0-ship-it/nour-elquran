import {afterEach,describe,expect,it,vi} from 'vitest';
import {compactStroke,fetchLiveInk} from './live-ink';

const learner={role:'learner' as const,lessonId:'lesson-35',learnerId:'child-a'};
const teacher={role:'teacher' as const,lessonId:'lesson-35'};
const stroke={id:'ink-learner-001',page:35,color:'#aabbcc',width:3,
 kind:'pen' as const,points:[{x:1,y:2},{x:3,y:4}]};
const snapshot={page:35,revision:1,strokes:[stroke]};
const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),
 {status,headers:{'content-type':'application/json'}});

afterEach(()=>vi.unstubAllGlobals());

describe('signed shared-classroom ink API',()=>{
 it('learner GET uses only verified learner-scoped URL, and accepts explicit write grant',async()=>{
  const fetcher=vi.fn().mockResolvedValue(response(200,
   {code:'INK_SNAPSHOT',ink:snapshot,canWrite:true}));
  vi.stubGlobal('fetch',fetcher);
  const result=await fetchLiveInk(learner,35);
  expect(result).toEqual({code:'INK_SNAPSHOT',ink:snapshot,canWrite:true});
  expect(fetcher).toHaveBeenCalledWith(
   '/v1/me/learners/child-a/lessons/lesson-35/quran-ink?page=35',
   expect.objectContaining({method:'GET',credentials:'same-origin',redirect:'error'}));
 });
 it('teacher uses a separate authenticated route, not client-claimed role or learner',async()=>{
  const fetcher=vi.fn().mockResolvedValue(response(200,
   {code:'INK_SNAPSHOT',ink:snapshot,canWrite:false}));
  vi.stubGlobal('fetch',fetcher);
  expect((await fetchLiveInk(teacher,35)).canWrite).toBe(false);
  expect(fetcher.mock.calls[0]?.[0]).toBe('/v1/teacher/lessons/lesson-35/quran-ink?page=35');
 });
 it('accepts 202 pending but never fabricates a globally saved acknowledgement',async()=>{
  const fetcher=vi.fn().mockResolvedValue(response(202,
   {code:'INK_PENDING_PERSISTENCE',ink:snapshot,persistence:'pending'}));
  vi.stubGlobal('fetch',fetcher);
  const change={action:'add' as const,page:35,expectedRevision:0,
   requestId:'operation-learner-001',stroke};
  const result=await fetchLiveInk(learner,35,change);
  expect(result.persistence).toBe('pending');
  expect(result.code).toBe('INK_PENDING_PERSISTENCE');
  expect(result.canWrite).toBeUndefined();
  const sent=JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string,unknown>;
  expect(sent).toEqual(change);
  expect(sent).not.toHaveProperty('actorSubject');
  expect(sent).not.toHaveProperty('role');
 });
 it('ignores invalid write grants and rejects malformed ink snapshots',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(response(200,
   {code:'INK_SNAPSHOT',ink:snapshot,canWrite:'true'}))
   .mockResolvedValueOnce(response(200,
   {code:'INK_SNAPSHOT',ink:{...snapshot,strokes:[{...stroke,width:999}]},canWrite:true}));
  vi.stubGlobal('fetch',fetcher);
  expect((await fetchLiveInk(learner,35)).canWrite).toBeUndefined();
  await expect(fetchLiveInk(learner,35)).rejects.toThrow('CLASSROOM_INK_UNAVAILABLE');
 });
 it('disabled write and revoked session fail closed, no local success',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(response(503,{code:'CUMULATIVE_INK_DISABLED'}))
   .mockResolvedValueOnce(response(404,{code:'NOT_FOUND'}));
  vi.stubGlobal('fetch',fetcher);
  await expect(fetchLiveInk(learner,35)).rejects.toThrow('CUMULATIVE_INK_DISABLED');
  await expect(fetchLiveInk(learner,35)).rejects.toThrow('NOT_FOUND');
 });
 it('compacts S Pen strokes to the server point limit without changing page/author ID',()=>{
  const many={...stroke,points:Array.from({length:2500},(_,i)=>({x:i/2.5,y:i/2}))};
  const small=compactStroke(many);
  expect(small.points).toHaveLength(600);
  expect(small.id).toBe(many.id);
  expect(small.page).toBe(35);
  expect(small.points[0]).toEqual(many.points[0]);
  expect(small.points.at(-1)).toEqual(many.points.at(-1));
 });
});
