import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
const Request = globalThis.Request;
import { stagingAccessGuard } from '../workers/site/src/staging-access.ts';

const stage = 'https://noor-site-staging.example.workers.dev/';
const password = 'test-only-cred-not-for-deploy-01234567890123456789';
const env = { NOOR_ENVIRONMENT: 'staging', STAGING_ACCESS_PASSWORD: password };
const auth = 'Basic ' + Buffer.from('noor-preview:' + password).toString('base64');
test('unconfigured staging fails closed for both API and assets', () => {
  for (const endpoint of ['/', '/api/auth/login', '/ready']) {
    const result = stagingAccessGuard(new Request(stage + endpoint.slice(1)), {NOOR_ENVIRONMENT:'staging'});
    assert.equal(result?.status, 503);
  }
});
test('staging denies unauthenticated browsing and bypasses', () => {
  for (const pathname of ['', 'api/auth/session', 'student/', '_next/static/file.js']) {
    const url = stage + pathname;
    assert.equal(stagingAccessGuard(new Request(url),env)?.status, 401);
    const response = stagingAccessGuard(new Request(url, {headers: {Authorization:'Basic invalid'}}),env);
    assert.equal(response?.status, 401);
    assert.match(response?.headers.get('WWW-Authenticate') ?? '', /Noor Staging/);
    assert.equal(response?.headers.get('Cache-Control'), 'no-store');
  }
});
test('valid staging credential is accepted but does not grant app session', () => {
  assert.equal(stagingAccessGuard(new Request(stage, {headers: {Authorization: auth}}),env),null);
});
test('worker staging hostname fails closed even when env flag is forgotten', () => {
  assert.equal(stagingAccessGuard(new Request(stage),{} )?.status,503);
  assert.equal(stagingAccessGuard(new Request(stage,{headers: {Authorization:auth}}),{STAGING_ACCESS_PASSWORD:password}),null);
});
test('production requests do not require staging credentials', () => {
  assert.equal(stagingAccessGuard(new Request('https://noor.example.org/'),{}),null);
});
