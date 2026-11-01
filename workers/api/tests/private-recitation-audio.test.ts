import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {
  MAX_RECITATION_BYTES,MAX_RECITATION_DURATION_MS,
  parsePrivateAudioDescriptor,privateRecitationObjectKey,
  privateRecitationResponseHeaders,privateAudioContainerMatches,
  verifyPrivateAudioBytes,PRIVATE_RECITATION_UPLOADS_ENABLED,
} from '../src/private-recitation-audio.ts';

const assetId='32a8e27c-400a-4cfe-aee7-81bf2895bdeb';
const submissionId='d9bdcf4a-75f4-469d-8dbd-a8f645d01124';
const learnerId='7e751dfa-f248-4c1a-8c28-c212267b1e3f';
const base={assetId,submissionId,mediaType:'audio/webm',byteSize:4096,
  durationMs:32000,sha256:'a'.repeat(64)};
test('private audio envelope rejects misleading metadata, wrong sizes and untrusted IDs',()=>{
  assert.deepEqual(parsePrivateAudioDescriptor(base),base);
  for(const value of [null,[],{...base,owner:'forged'}, {...base,mediaType:'audio/mpeg'}, {...base,mediaType:'toString'}, {...base,mediaType:'constructor'},
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
  // Runtime boundaries must reject unparsed objects even if a caller casts them
  // to PrivateAudioDescriptor or a string in TypeScript.
  assert.throws(()=>privateRecitationObjectKey([learnerId] as never,descriptor),/INVALID_PRIVATE_AUDIO_KEY/);
  for(const unsafe of [
    null,
    {...descriptor,submissionId:'../../foreign'},
    {...descriptor,byteSize:MAX_RECITATION_BYTES+1},
    {...descriptor,durationMs:0},
    {...descriptor,sha256:'A'.repeat(64)},
    {...descriptor,mediaType:'text/html'},
  ])assert.throws(()=>privateRecitationObjectKey(learnerId,unsafe as never),/INVALID_PRIVATE_AUDIO_KEY/);
  const ogg=parsePrivateAudioDescriptor({...base,mediaType:'audio/ogg'});
  const mp4=parsePrivateAudioDescriptor({...base,mediaType:'audio/mp4'});
  assert.ok(ogg&&mp4);
  assert.equal(privateRecitationObjectKey(learnerId,ogg).endsWith('.ogg'),true);
  assert.equal(privateRecitationObjectKey(learnerId,mp4).endsWith('.m4a'),true);
});
test('private playback headers are never cacheable and audio is hard disabled',()=>{
  const h=privateRecitationResponseHeaders('audio/webm');
  assert.match(h.get('cache-control')??'',/no-store/);
  assert.equal(h.get('content-type'),'audio/webm');
  for(const unsafe of ['text/html','audio/webm; charset=utf-8','audio/mpeg',null,[]])
    assert.throws(()=>privateRecitationResponseHeaders(unsafe as never),/INVALID_PRIVATE_AUDIO_MEDIA_TYPE/);
  assert.equal(h.get('x-content-type-options'),'nosniff');
  assert.equal(h.get('referrer-policy'),'no-referrer');
  assert.equal(PRIVATE_RECITATION_UPLOADS_ENABLED,false);
});

test('private binary guard verifies exact synthetic WebM header, bounded size and SHA-256',async()=>{
 const webm=Uint8Array.from([0x1a,0x45,0xdf,0xa3,0x86,0x81,0x01,0x42,0x82,0x84,
  0x77,0x65,0x62,0x6d,0x00,0x01]);
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',webm)),
  b=>b.toString(16).padStart(2,'0')).join('');
 const descriptor={...base,byteSize:webm.byteLength,sha256:sha};
 assert.equal(privateAudioContainerMatches('audio/webm',webm),true);
 assert.equal(await verifyPrivateAudioBytes(descriptor,webm),'ok');
 // Cryptographically different bytes with identical length and header.
 const modified=Uint8Array.from(webm);modified[15]=0x02;
 assert.equal(await verifyPrivateAudioBytes(descriptor,modified),'hash_mismatch');
 assert.equal(await verifyPrivateAudioBytes({...descriptor,byteSize:3},webm),'size_mismatch');
 assert.equal(await verifyPrivateAudioBytes(descriptor,webm.slice(0,-1)),'size_mismatch');
 assert.equal(await verifyPrivateAudioBytes({...descriptor,mediaType:'audio/ogg'},webm),
  'container_mismatch');
 assert.equal(await verifyPrivateAudioBytes({...descriptor,mediaType:'text/html'},webm),
  'invalid_descriptor');
 assert.equal(await verifyPrivateAudioBytes(descriptor,Array.from(webm)),
  'invalid_descriptor');
 assert.equal(await verifyPrivateAudioBytes({...descriptor,byteSize:MAX_RECITATION_BYTES+1},
  webm),'invalid_descriptor');
});
test('private container marker resists MIME spoofing, generic EBML, fake Ogg and malformed MP4',()=>{
 const webm=Uint8Array.from([0x1a,0x45,0xdf,0xa3,0x86,0x81,0x01,0x42,0x82,0x84,
  0x77,0x65,0x62,0x6d,0x00,0x01]);
 const generic=Uint8Array.from(webm);
 generic[10]=0x6d;generic[11]=0x6b;generic[12]=0x76;generic[13]=0x00;
 assert.equal(privateAudioContainerMatches('audio/webm',generic),false);
 assert.equal(privateAudioContainerMatches('audio/webm',new TextEncoder().encode(
  '<html><script>danger()</script></html>')),false);
 const ogg=new Uint8Array(27);ogg.set([0x4f,0x67,0x67,0x53,0]);
 assert.equal(privateAudioContainerMatches('audio/ogg',ogg),true);
 ogg[4]=1;
 assert.equal(privateAudioContainerMatches('audio/ogg',ogg),false);
 const mp4=Uint8Array.from([0,0,0,20,0x66,0x74,0x79,0x70,0x4d,0x34,
  0x41,0x20,0,0,0,0,0x69,0x73,0x6f,0x6d]);
 assert.equal(privateAudioContainerMatches('audio/mp4',mp4),true);
 const broken=Uint8Array.from(mp4);broken[3]=21;
 assert.equal(privateAudioContainerMatches('audio/mp4',broken),false);
 assert.equal(privateAudioContainerMatches('audio/ogg',mp4),false);
 assert.equal(privateAudioContainerMatches('audio/webm',mp4),false);
 assert.equal(privateAudioContainerMatches('audio/mp4',new Uint8Array(0)),false);
 assert.equal(privateAudioContainerMatches('audio/ogg',{} as never),false);
});
