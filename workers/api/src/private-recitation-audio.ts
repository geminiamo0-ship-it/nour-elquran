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
    typeof value.mediaType!=='string'||!(value.mediaType in extensions)||
    !Number.isSafeInteger(value.byteSize)||Number(value.byteSize)<1||
    Number(value.byteSize)>MAX_RECITATION_BYTES||
    !Number.isSafeInteger(value.durationMs)||Number(value.durationMs)<1||
    Number(value.durationMs)>MAX_RECITATION_DURATION_MS||
    typeof value.sha256!=='string'||!sha256.test(value.sha256))return null;
  return {assetId:value.assetId,submissionId:value.submissionId,
    mediaType:value.mediaType as MediaType,byteSize:value.byteSize as number,
    durationMs:value.durationMs as number,sha256:value.sha256};
}
/** Generate an opaque R2 key with NO name, phone, account or signed URL. Server only. */
export function privateRecitationObjectKey(learnerId:string,descriptor:PrivateAudioDescriptor):string{
  if(!uuidV4.test(learnerId)||!uuidV4.test(descriptor.assetId)||
    !(descriptor.mediaType in extensions))throw new Error('INVALID_PRIVATE_AUDIO_KEY');
  return `assignment-audio/${learnerId}/${descriptor.assetId}.${extensions[descriptor.mediaType]}`;
}
/** Never allow a private response to be cached by a CDN, intermediary or browser. */
export function privateRecitationResponseHeaders(mediaType:MediaType):Headers{
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
