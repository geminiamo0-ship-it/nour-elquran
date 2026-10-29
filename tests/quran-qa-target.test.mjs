import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNoorDevQaTarget} from '../scripts/noor-quran-qa-target.mjs';

const approved='https://noor-site-staging.geminiamo0.workers.dev';
test('synthetic Quran QA only accepts the explicit development Worker origin',()=>{
  assert.equal(assertNoorDevQaTarget({
    NOOR_QA_ORIGIN:approved,NOOR_QA_RUN_SYNTHETIC:'yes',
  }),approved);
  assert.throws(()=>assertNoorDevQaTarget({NOOR_QA_ORIGIN:approved}),/explicit opt-in/);
  assert.throws(()=>assertNoorDevQaTarget({
    NOOR_QA_ORIGIN:approved,NOOR_QA_RUN_SYNTHETIC:'true',
  }),/explicit opt-in/);
});
test('Quran QA target rejects production, preview, redirects and alternate hosts',()=>{
  for(const origin of [
    'http://noor-site-staging.geminiamo0.workers.dev',
    'https://noor-site-staging.geminiamo0.workers.dev/',
    'https://noor-site-staging.geminiamo0.workers.dev/anything',
    'https://noor-site-staging.geminiamo0.workers.dev?redirect=1',
    'https://noor-site-staging.geminiamo0.workers.dev.evil.invalid',
    'https://noor-site-staging.other-account.workers.dev',
    'https://noor-site-staging.geminiamo1.workers.dev',
    'https://noor-site-quran-qa.geminiamo0.workers.dev',
    'https://nour-elquran.geminiamo0.workers.dev',
    'https://example.com',
    'http://127.0.0.1:8797',
    '',
  ])assert.throws(()=>assertNoorDevQaTarget({
    NOOR_QA_ORIGIN:origin,NOOR_QA_RUN_SYNTHETIC:'yes',
  }),/exact Noor development Worker origin/,origin);
});
