import type {LessonRow} from '../shared';

/** Prepared lesson suggestions must derive from a signed, owner-scoped D1 list.
 * Never interpret stale, cancelled, completed or cross-sibling records as next.
 */
export function nextVerifiedPreparationLesson(
 rows:readonly LessonRow[],learnerId:string,now:number
):LessonRow|null{
 if(!/^[A-Za-z0-9-]{1,128}$/.test(learnerId)||
  !Number.isSafeInteger(now)||now<0||
  rows.some(x=>x.learnerId!==learnerId))throw Error('INVALID_OWNER_LESSONS');
 return rows.filter(x=>(x.status==='scheduled'||x.status==='live')&&x.endsAtMs>now)
  .sort((a,b)=>a.startsAtMs-b.startsAtMs)[0]??null;
}
