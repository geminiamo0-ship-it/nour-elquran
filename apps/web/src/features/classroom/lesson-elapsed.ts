/** Lesson duration only starts at the authoritative D1 Sheikh Start timestamp.
 * It is an elapsed counter, never a local Start or auto-End decision.
 */
export function elapsedLessonLabel(startedAtMs:number|null,nowMs:number):string|null{
 if(startedAtMs===null||!Number.isSafeInteger(startedAtMs)||startedAtMs<0||
  !Number.isSafeInteger(nowMs)||nowMs<startedAtMs)return null;
 const seconds=Math.floor((nowMs-startedAtMs)/1000);
 const pad=(n:number)=>String(n).padStart(2,'0');
 const hours=Math.floor(seconds/3600);
 const minutes=Math.floor(seconds/60)%60;
 const secs=seconds%60;
 return hours>0?`${pad(hours)}:${pad(minutes)}:${pad(secs)}`:
  `${pad(Math.floor(seconds/60))}:${pad(secs)}`;
}
