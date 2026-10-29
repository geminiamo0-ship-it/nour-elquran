import { describe, expect, it } from 'vitest';
import { AccountError, createAccountClient, parseLearners, parseSession } from './api';

const id = '10b4e832-c325-4da9-8cff-e1f10d209156';
const row = { id, name: 'Synthetic learner', learnerType: 'child', revision: 1 };
describe('same-origin account contract', () => {
  it('strips all internal credential fields from session and profile DTOs', () => {
    expect(parseSession({ user: { id: 'subject', name: 'Owner', email: 'internal.invalid', password: 'redacted' }, phoneVerified: false, token: 'redacted' }))
      .toEqual({ user: { id: 'subject', name: 'Owner' }, phoneVerified: false });
    expect(parseLearners({ learners: [{ ...row, accountId: 'untrusted' }] })).toEqual([row]);
  });
  it('rejects malformed, demo-identity, duplicated and oversized profile responses', () => {
    for (const learners of [[{ ...row, id: 'demo-active' }], [row, row], [{ ...row, learnerType: 'staff' }], [{ ...row, revision: 0 }], [{ id, name:'Missing revision', learnerType:'child' }], Array(9).fill(row)]) {
      expect(() => parseLearners({ learners })).toThrow(AccountError);
    }
    expect(() => parseSession({ user: { id: 'x', name: 'x' }, phoneVerified: 'true' })).toThrow(AccountError);
  });
  it('uses fixed same-origin cookie requests without caching, redirect or browser token fallback', async () => {
    const calls: { path: string; options: RequestInit | undefined }[] = [];
    const transport: typeof fetch = async (input, options) => {
      calls.push({ path: String(input), options });
      return Response.json({ learners: [row] });
    };
    const api = createAccountClient(transport);
    expect(await api.learners()).toEqual([row]);
    expect(calls).toMatchObject([{ path: '/v1/me/learners', options: { credentials: 'same-origin', cache: 'no-store', redirect: 'error', method: 'GET' } }]);
    expect(calls[0]?.options?.headers).toBeUndefined();
  });
  it('preserves expired/rate-limited status and fails safely on offline or invalid JSON', async () => {
    for (const status of [401, 429, 503]) {
      const api = createAccountClient(async () => Response.json({ code: 'SAFE_ERROR' }, { status }));
      await expect(api.session()).rejects.toMatchObject({ status, code: 'SAFE_ERROR' });
    }
    await expect(createAccountClient(async () => { throw Error('private network detail'); }).session())
      .rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await expect(createAccountClient(async () => new Response('not-json')).session())
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('sends learner input only in POST JSON, never in URLs', async () => {
    let sent: RequestInit | undefined;
    const api = createAccountClient(async (input, options) => {
      expect(input).toBe('/v1/me/learners'); sent = options; return Response.json({ learner: row });
    });
    await api.createLearner({ name: row.name, learnerType: 'child' });
    expect(sent?.method).toBe('POST');
    expect(JSON.parse(String(sent?.body))).toEqual({ name: row.name, learnerType: 'child' });
  });
  it('submits versioned profile rename/archive only through a validated same-origin owner route',async()=>{
    const calls: Array<{path:string;options:RequestInit|undefined}>=[];
    const api=createAccountClient(async(input,options)=>{
      calls.push({path:String(input),options});
      return Response.json({code:'PROFILE_UPDATED',revision:2});
    });
    const operationId='48f455f7-65cf-4904-9bc3-fdfb7ba2f620';
    await expect(api.profileAction(id,{action:'rename',name:'Second',operationId,expectedRevision:1}))
      .resolves.toEqual({code:'PROFILE_UPDATED',revision:2});
    expect(calls[0]?.path).toBe('/v1/me/learners/'+id+'/profile-actions');
    expect(calls[0]?.options).toMatchObject({method:'POST',credentials:'same-origin',cache:'no-store'});
    expect(JSON.parse(String(calls[0]?.options?.body))).toEqual({
      action:'rename',name:'Second',operationId,expectedRevision:1,
    });
    await expect(api.profileAction('../other',{action:'archive',operationId,expectedRevision:1}))
      .rejects.toMatchObject({code:'INVALID_LEARNER_ID'});
    expect(calls).toHaveLength(1);
  });
  it('never accepts a malformed server acknowledgement as a saved edit',async()=>{
    const api=createAccountClient(async()=>Response.json({code:'PROFILE_UPDATED',revision:99}));
    await expect(api.profileAction(id,{
      action:'archive',operationId:'48f455f7-65cf-4904-9bc3-fdfb7ba2f620',expectedRevision:1,
    })).rejects.toMatchObject({code:'INVALID_RESPONSE'});
  });

});
