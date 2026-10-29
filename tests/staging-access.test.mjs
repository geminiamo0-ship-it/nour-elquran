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

test('public demo serves GET/HEAD pages and assets without staging password', () => {
  const demoEnv = { NOOR_ENVIRONMENT: 'staging', NOOR_PUBLIC_PREVIEW: 'true', STAGING_ACCESS_PASSWORD: password };
  for (const path of ['', 'student/', 'student/mushaf/', '_next/static/demo.js', 'favicon.ico']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal(stagingAccessGuard(new Request(stage + path, { method }), demoEnv), null);
    }
  }
});
test('public demo keeps account, readiness, and learner APIs behind Basic Auth', () => {
  const demoEnv = { NOOR_ENVIRONMENT: 'staging', NOOR_PUBLIC_PREVIEW: 'true', STAGING_ACCESS_PASSWORD: password };
  for (const path of ['api', 'api/auth/session', 'api/auth/register', 'v1', 'v1/me/learners', 'internal-auth/check', 'health', 'ready']) {
    const url = stage + path;
    assert.equal(stagingAccessGuard(new Request(url), demoEnv)?.status, 401);
    assert.equal(stagingAccessGuard(new Request(url, {headers: {Authorization: auth}}), demoEnv), null);
  }
});
test('public demo never permits write methods without a staging credential', () => {
  const demoEnv = { NOOR_ENVIRONMENT: 'staging', NOOR_PUBLIC_PREVIEW: 'true', STAGING_ACCESS_PASSWORD: password };
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(stagingAccessGuard(new Request(stage + 'student/', { method }), demoEnv)?.status, 401);
  }
  assert.equal(stagingAccessGuard(new Request(stage + 'api/auth/register'), {NOOR_PUBLIC_PREVIEW:'true'})?.status, 503);
  // An unconfigured API stays closed even while read-only preview pages work.
  assert.equal(stagingAccessGuard(new Request(stage), {NOOR_PUBLIC_PREVIEW:'true'}), null);
});

test('developer environment preserves application routing', () => {
  const configured = { NOOR_ENVIRONMENT: 'staging', NOOR_DEV_OPEN: 'true' };
  assert.equal(stagingAccessGuard(new Request(stage), configured), null);
  assert.equal(stagingAccessGuard(new Request(stage + 'api/auth/session'), configured), null);
});
