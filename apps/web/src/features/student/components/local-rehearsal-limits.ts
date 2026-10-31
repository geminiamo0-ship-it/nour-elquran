/** Browser-only voice rehearsal limits, NOT an upload or guardian consent policy.
 * An untrusted MediaRecorder can emit a single huge chunk or continue while
 * a background tab throttles its stop timer; reject both before retaining data.
 */
export const LOCAL_REHEARSAL_MAX_BYTES=8*1024*1024;
export const LOCAL_REHEARSAL_MAX_MS=4*60*1000;
export type LocalRehearsalLimit='ok'|'too_large'|'too_long'|'invalid';

export function localRehearsalLimit(totalBytes:number,chunkBytes:number,elapsedMs:number):
 LocalRehearsalLimit {
 if(!Number.isSafeInteger(totalBytes)||totalBytes<0||
  !Number.isSafeInteger(chunkBytes)||chunkBytes<0||
  !Number.isFinite(elapsedMs)||elapsedMs<0)return 'invalid';
 if(elapsedMs>LOCAL_REHEARSAL_MAX_MS)return 'too_long';
 if(chunkBytes>LOCAL_REHEARSAL_MAX_BYTES||
    totalBytes>LOCAL_REHEARSAL_MAX_BYTES-chunkBytes)return 'too_large';
 return 'ok';
}
