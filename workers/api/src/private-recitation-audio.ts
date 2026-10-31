/** #182 Private R2 recitation envelope. No public upload/playback is enabled. */
export const MAX_RECITATION_BYTES=8*1024*1024;
export const MAX_RECITATION_DURATION_MS=240_000;
const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256=/^[0-9a-f]{64}$/;
const extensions={'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a'} as const;
type MediaType=keyof typeof extensions;
export type PrivateAudioDescriptor=Readonly<{
  assetId:string;submissionId:string;mediaType:MediaType;
  byteSize:number;durationMs:number;sha256:string;
}>;
const record=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
export function parsePrivateAudioDescriptor(value:unknown):PrivateAudioDescriptor|null{
  if(!record(value))return null;
  const expected=['assetId','submissionId','mediaType','byteSize','durationMs','sha256'];
  if(Object.keys(value).length!==expected.length||!expected.every(key=>key in value)||
    typeof value.assetId!=='string'||!uuidV4.test(value.assetId)||
    typeof value.submissionId!=='string'||!uuidV4.test(value.submissionId)||
    typeof value.mediaType!=='string'||!Object.hasOwn(extensions,value.mediaType)||
    !Number.isSafeInteger(value.byteSize)||Number(value.byteSize)<1||
    Number(value.byteSize)>MAX_RECITATION_BYTES||
    !Number.isSafeInteger(value.durationMs)||Number(value.durationMs)<1||
    Number(value.durationMs)>MAX_RECITATION_DURATION_MS||
    typeof value.sha256!=='string'||!sha256.test(value.sha256))return null;
  return {assetId:value.assetId,submissionId:value.submissionId,
    mediaType:value.mediaType as MediaType,byteSize:value.byteSize as number,
    durationMs:value.durationMs as number,sha256:value.sha256};
}
/** Structural container identification only, NOT codec/decoding, duration,
 * virus or content-policy verification. This must run before any future R2 put.
 * It never enables upload and never emits media bytes or a signed URL.
 */
export type PrivateAudioByteCheck=
 'ok'|'invalid_descriptor'|'size_mismatch'|'container_mismatch'|'hash_mismatch';

const bytesEqual=(bytes:Uint8Array,prefix:readonly number[],offset=0)=>
 bytes.length>=offset+prefix.length&&prefix.every((b,i)=>bytes[offset+i]===b);
const utf8Marker=(text:string)=>Array.from(text,ch=>ch.charCodeAt(0));
const hasMarker=(bytes:Uint8Array,needle:readonly number[],maxStart:number)=>{
 const end=Math.min(bytes.length-needle.length,maxStart);
 for(let i=0;i<=end;i++){
  if(bytesEqual(bytes,needle,i))return true;
 }
 return false;
};
export function privateAudioContainerMatches(mediaType:MediaType,bytes:Uint8Array):boolean{
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<12||
   !Object.hasOwn(extensions,mediaType))return false;
 if(mediaType==='audio/webm'){
  // EBML header + explicit WebM DocType. Matroska or generic EBML alone
  // must not be accepted as audio/webm.
  return bytesEqual(bytes,[0x1a,0x45,0xdf,0xa3])&&
   hasMarker(bytes,[0x42,0x82,0x84,...utf8Marker('webm')],1024);
 }
 if(mediaType==='audio/ogg'){
  // Capture-pattern with Ogg stream version zero.
  return bytes.length>=27&&bytesEqual(bytes,[0x4f,0x67,0x67,0x53,0x00]);
 }
 // MP4 ftyp box and an allowed brand seen in audio/mp4 browser recordings.
 // A brand is NOT proof that the MP4 contains only audio; full decoder and
 // codec validation is a separate mandatory release gate.
 if(!bytesEqual(bytes,utf8Marker('ftyp'),4))return false;
 const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0,false);
 if(size<16||size>bytes.byteLength||size>4096)return false;
 const brands=['M4A ','M4B ','isom','iso2','mp41','mp42'];
 const brand=(off:number)=>String.fromCharCode(...bytes.slice(off,off+4));
 if(brands.includes(brand(8)))return true;
 for(let off=16;off+4<=size;off+=4){
  if(brands.includes(brand(off)))return true;
 }
 return false;
}

/** Verify untrusted uploaded bytes using descriptor, size, container and
 * SHA-256 before any future private storage. Returns codes, never data.
 * This is a source-only guard; the policy/guardian/R2 write locks stay OFF.
 */
export async function verifyPrivateAudioBytes(raw:unknown,rawBytes:unknown):
 Promise<PrivateAudioByteCheck>{
 const descriptor=parsePrivateAudioDescriptor(raw);
 if(!descriptor||!(rawBytes instanceof Uint8Array))return 'invalid_descriptor';
 if(rawBytes.byteLength!==descriptor.byteSize)return 'size_mismatch';
 if(!privateAudioContainerMatches(descriptor.mediaType,rawBytes))return 'container_mismatch';
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(rawBytes)));
 const hex=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 return hex===descriptor.sha256?'ok':'hash_mismatch';
}

/** Generate an opaque R2 key with NO name, phone, account or signed URL. Server only. */
export function privateRecitationObjectKey(learnerId:string,descriptor:PrivateAudioDescriptor):string{
  // TypeScript types disappear at runtime. Revalidate the entire envelope here
  // so a future call site cannot mint a key for forged/oversized media metadata.
  const checked=parsePrivateAudioDescriptor(descriptor);
  if(typeof learnerId!=='string'||!uuidV4.test(learnerId)||!checked)
    throw new Error('INVALID_PRIVATE_AUDIO_KEY');
  return `assignment-audio/${learnerId}/${checked.assetId}.${extensions[checked.mediaType]}`;
}
/** Never allow a private response to be cached by a CDN, intermediary or browser. */
export function privateRecitationResponseHeaders(mediaType:MediaType):Headers{
  // Never let a runtime-cast MIME type become an inline HTML or other response.
  if(typeof mediaType!=='string'||!Object.hasOwn(extensions,mediaType))
    throw new Error('INVALID_PRIVATE_AUDIO_MEDIA_TYPE');
  const headers=new Headers({
    'Cache-Control':'private, no-store, max-age=0',
    'Content-Type':mediaType,
    'Content-Disposition':'inline; filename="recitation"',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
  });
  return headers;
}
/** Policy is deliberately not represented as a configurable boolean.
 * No adult or child audio becomes reachable through a stray Workers env flag.
 * This code must change only with separately verified guardianship/retention gates. */
export const PRIVATE_RECITATION_UPLOADS_ENABLED=false as const;
