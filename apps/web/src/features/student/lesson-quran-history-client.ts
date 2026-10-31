import {parseCumulativePage,type CumulativeQuranMark} from './cumulative-quran-client';

export type LessonQuranHistory=Readonly<{
 learnerId:string;lessonId:string;asOfMs:number;pages:readonly number[];
 marks:readonly CumulativeQuranMark[];
}>;
export class LessonQuranHistoryError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const id=/^[A-Za-z0-9-]{1,128}$/;
const obj=(x:unknown):x is Record<string,unknown>=>
 x!==null&&typeof x==='object'&&!Array.isArray(x);

/** Reject stale/cross-learner responses, malicious pages and private marks. */
export function parseLessonQuranHistory(raw:unknown,learnerId:string,lessonId:string,
 page:number|null):LessonQuranHistory{
 if(!obj(raw)||raw.code!=='QURAN_LESSON_HISTORY'||raw.learnerId!==learnerId||
    raw.lessonId!==lessonId||!Number.isSafeInteger(raw.asOfMs)||Number(raw.asOfMs)<0||
    !Array.isArray(raw.pages)||raw.pages.length>604||
    !raw.pages.every((p,i)=>Number.isSafeInteger(p)&&p>=1&&p<=604&&
      (i===0||p>raw.pages[i-1]))||
    !Array.isArray(raw.marks)||raw.marks.length>300)
   throw new LessonQuranHistoryError('INVALID_HISTORY_RESPONSE');
 const pages=raw.pages as number[];
 if(page!==null&&!pages.includes(page))
   throw new LessonQuranHistoryError('INVALID_HISTORY_PAGE');
 if(page===null&&raw.marks.length>0)
   throw new LessonQuranHistoryError('INVALID_HISTORY_INDEX');
 const marks=page===null?[]:parseCumulativePage({
  code:'QURAN_COMPOSITE_READ',learnerId,current:raw.marks,legacyPrivate:[]
 },learnerId,page).marks;
 if(marks.some(m=>m.audience!=='shared'||!m.visible||
   (m.originType!=='lesson'&&m.originType!=='assignment')||
   (m.kind==='note'&&typeof m.payload.text!=='string')))
   throw new LessonQuranHistoryError('INVALID_HISTORY_MARK');
 return {learnerId,lessonId,asOfMs:raw.asOfMs as number,pages,marks};
}
export async function fetchLessonQuranHistory(learnerId:string,lessonId:string,
 page:number|null,signal?:AbortSignal):Promise<LessonQuranHistory>{
 if(!id.test(learnerId)||!id.test(lessonId)||
   (page!==null&&(!Number.isInteger(page)||page<1||page>604)))
   throw new LessonQuranHistoryError('INVALID_HISTORY_SCOPE');
 const path='/v1/me/learners/'+encodeURIComponent(learnerId)+
  '/lessons/'+encodeURIComponent(lessonId)+'/quran-history'+
  (page===null?'':'?page='+page);
 let response:Response;
 try{response=await fetch(path,{method:'GET',credentials:'same-origin',
  cache:'no-store',redirect:'error',signal});}
 catch{throw new LessonQuranHistoryError('HISTORY_NETWORK_ERROR');}
 let data:unknown;
 try{data=await response.json();}
 catch{throw new LessonQuranHistoryError('INVALID_HISTORY_RESPONSE',response.status);}
 if(!response.ok)throw new LessonQuranHistoryError(obj(data)&&typeof data.code==='string'
  ?data.code:'HISTORY_UNAVAILABLE',response.status);
 return parseLessonQuranHistory(data,learnerId,lessonId,page);
}
