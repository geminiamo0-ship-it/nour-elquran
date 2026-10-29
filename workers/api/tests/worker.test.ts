import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { handleRequest } from '../src/index.ts';
import type { Env } from '../src/bindings.ts';

const request = (path: string, init?: RequestInit) => new Request('https://noor.invalid' + path, init);
test('liveness identifies the scaffold without pretending authentication exists', async () => {
  for (const path of ['/health', '/healthz']) {
  const response = await handleRequest(request(path), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).phase, 'foundation');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
});
test('unconfigured database is not ready', async () => {
  const response = await handleRequest(request('/ready'), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'DATABASE_NOT_CONFIGURED');
});
test('schema readiness does not claim that auth is integrated', async () => {
  const env = { DB: { prepare: () => ({ first: async () => ({ version: 1 }) }) } } as unknown as Env;
  const response = await handleRequest(request('/ready'), env);
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.database, 'ready');
  assert.equal(body.code, 'AUTH_NOT_CONFIGURED');
});
test('missing migration fails readiness', async () => {
  const env = { DB: { prepare: () => ({ first: async () => null }) } } as unknown as Env;
  const response = await handleRequest(request('/ready'), env);
  assert.equal((await response.json()).code, 'SCHEMA_NOT_READY');
});
test('database failure hides internal query and customer details', async () => {
  const env = { DB: { prepare: () => { throw Error('private database secret'); } } } as unknown as Env;
  const response = await handleRequest(request('/ready'), env);
  assert.equal(response.status, 503);
  const text = await response.text();
  assert.match(text, /DATABASE_UNAVAILABLE/);
  assert.doesNotMatch(text, /private database secret/);
});
test('forged identity and authorization headers never unlock protected routes or access DB', async () => {
  let reads = 0;
  const env = { DB: { prepare: () => { reads++; throw Error('must not read'); } } } as unknown as Env;
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    for (const path of ['/v1', '/v1/learners/other/notebook']) {
    const response = await handleRequest(request(path, {
      method, headers: { 'x-user-id': 'other', authorization: 'Bearer forged', cookie: 'session=forged' },
    }), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'AUTH_NOT_CONFIGURED');
  }
  }
  assert.equal(reads, 0);
});
test('unknown routes and wrong health method return 404', async () => {
  assert.equal((await handleRequest(request('/unknown'), {})).status, 404);
  assert.equal((await handleRequest(request('/health', { method: 'POST' }), {})).status, 404);
});
