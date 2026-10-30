import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {
  MAX_RECITATION_BYTES,MAX_RECITATION_DURATION_MS,
  parsePrivateAudioDescriptor,privateRecitationObjectKey,
  privateRecitationResponseHeaders,PRIVATE_RECITATION_UPLOADS_ENABLED,
} from '../src/private-recitation-audio.ts';

const assetId='32a8e27c-400a-4cfe-aee7-81bf2895bdeb';
const submissionId='d9bdcf4a-75f4-469d-8dbd-a8f645d01124';
const learnerId='7e751dfa-f248-4c1a-8c28-c212267b1e3f';
const base={assetId,submissionId,mediaType:'audio/webm',byteSize:4096,
  durationMs:32000,sha256:'a'.repeat(64)};
test('private audio envelope rejects misleading metadata, wrong sizes and untrusted IDs',()=>{
  assert.deepEqual(parsePrivateAudioDescriptor(base),base);
  for(const value of [null,[],{...base,owner:'forged'}, {...base,mediaType:'audio/mpeg'},
    {...base,mediaType:'video/webm'}, {...base,byteSize:0},
    {...base,byteSize:MAX_RECITATION_BYTES+1}, {...base,byteSize:1.5},
    {...base,durationMs:0},{...base,durationMs:MAX_RECITATION_DURATION_MS+1},
    {...base,sha256:'A'.repeat(64)},{...base,sha256:'../private'},
    {...base,submissionId:'../../../etc/passwd'}, {...base,assetId:'unsafe'},
    {...base,sha256:null}])assert.equal(parsePrivateAudioDescriptor(value),null);
});
test('private object keys are opaque and canonical; never a public r2.dev URL',()=>{
  const descriptor=parsePrivateAudioDescriptor(base);
  assert.ok(descriptor);
  assert.equal(privateRecitationObjectKey(learnerId,descriptor),
    `assignment-audio/${learnerId}/${assetId}.webm`);
  assert.throws(()=>privateRecitationObjectKey('../foreign',descriptor));
  const ogg=parsePrivateAudioDescriptor({...base,mediaType:'audio/ogg'});
  const mp4=parsePrivateAudioDescriptor({...base,mediaType:'audio/mp4'});
  assert.ok(ogg&&mp4);
  assert.equal(privateRecitationObjectKey(learnerId,ogg).endsWith('.ogg'),true);
  assert.equal(privateRecitationObjectKey(learnerId,mp4).endsWith('.m4a'),true);
});
test('private playback headers are never cacheable and audio is hard disabled',()=>{
  const h=privateRecitationResponseHeaders('audio/webm');
  assert.match(h.get('cache-control')??'',/no-store/);
  assert.equal(h.get('x-content-type-options'),'nosniff');
  assert.equal(h.get('referrer-policy'),'no-referrer');
  assert.equal(PRIVATE_RECITATION_UPLOADS_ENABLED,false);
});
