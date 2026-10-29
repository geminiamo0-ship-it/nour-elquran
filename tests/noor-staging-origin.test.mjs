import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isNoorStagingOrigin,openNoorStagingChrome} from '../scripts/chrome-local.mjs';

test('browser remote exception is ONLY for Noor dedicated dev origin',async()=>{
  assert.equal(isNoorStagingOrigin('https://noor-site-staging.geminiamo0.workers.dev/'),true);
  for(const input of [
    'https://noor-site-staging.geminiamo0.workers.dev/evil',
    'http://noor-site-staging.geminiamo0.workers.dev/',
    'https://nour-elquran.geminiamo0.workers.dev/',
    'https://noor-site-staging.geminiamo0.workers.dev.evil.invalid/',
    'https://noor-site-staging.geminiamo0.workers.dev@evil.invalid/',
    'http://127.0.0.1:8797/',
    'https://santo.geminiamo0.workers.dev/',
  ]){
    assert.equal(isNoorStagingOrigin(input),false,input);
    await assert.rejects(()=>openNoorStagingChrome(input),/Only verified Noor development staging/);
  }
});
