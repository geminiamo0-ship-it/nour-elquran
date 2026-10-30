/** Signed LessonDO Quran page + teacher-selected Ayah state.
 * A selection is never accepted without the Worker's official metadata proof.
 */
export const LIVE_QURAN_EDITION='hafs-kfqc-v1.1.1' as const;
export const LIVE_QURAN_PAGE_COUNT=604;
export type VerseSelection=Readonly<{surah:number;ayah:number}>;
export type VerifiedPageCommand=Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher'|'learner';
 action:'snapshot'|'set';page?:number;expectedRevision?:number;requestId?:string;
 verse?:VerseSelection;
}>;
export type SharedPage=Readonly<{
 edition:typeof LIVE_QURAN_EDITION;page:number;revision:number;verse?:VerseSelection;
}>;
export type PageReceipt=Readonly<{
 actorSubject:string;requestId:string;page:number;revision:number;verse?:VerseSelection;
}>;
export type SharedPageRecord=SharedPage & Readonly<{receipts:PageReceipt[]}>;
const id=/^[a-zA-Z0-9-]{1,128}$/;
const req=/^[a-zA-Z0-9-]{8,128}$/;
export function validVerse(value:unknown):value is VerseSelection{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).length===2&&
  Number.isInteger(v.surah)&&Number(v.surah)>=1&&Number(v.surah)<=114&&
  Number.isInteger(v.ayah)&&Number(v.ayah)>=1&&Number(v.ayah)<=286;
}
export const initialPage=():SharedPageRecord=>({
 edition:LIVE_QURAN_EDITION,page:1,revision:0,receipts:[]
});
export function parseVerifiedPageCommand(raw:unknown):VerifiedPageCommand|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const v=raw as Record<string,unknown>,count=Object.keys(v).length;
 if(![5,8,9].includes(count)||
  !['lessonId','learnerId','actorSubject','role','action'].every(k=>Object.hasOwn(v,k))||
  typeof v.lessonId!=='string'||!id.test(v.lessonId)||
  typeof v.learnerId!=='string'||!id.test(v.learnerId)||
  typeof v.actorSubject!=='string'||!id.test(v.actorSubject)||
  (v.role!=='teacher'&&v.role!=='learner'))return null;
 if(v.action==='snapshot')return count===5?v as VerifiedPageCommand:null;
 if(v.action!=='set'||v.role!=='teacher'||![8,9].includes(count)||
  !['page','expectedRevision','requestId'].every(k=>Object.hasOwn(v,k))||
  (count===9&&(!Object.hasOwn(v,'verse')||!validVerse(v.verse)))||
  !Number.isInteger(v.page)||Number(v.page)<1||Number(v.page)>LIVE_QURAN_PAGE_COUNT||
  !Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0||
  typeof v.requestId!=='string'||!req.test(v.requestId))
  return null;
 return v as VerifiedPageCommand;
}
function sameVerse(a:VerseSelection|undefined,b:VerseSelection|undefined):boolean{
 return (!a&&!b)||!!(a&&b&&a.surah===b.surah&&a.ayah===b.ayah);
}
export function applyPageSet(current:SharedPageRecord,cmd:VerifiedPageCommand):
 {code:'QURAN_PAGE_SET'|'QURAN_PAGE_REPLAY'|'QURAN_PAGE_CONFLICT';next:SharedPageRecord}{
 const replay=current.receipts.find(x=>x.actorSubject===cmd.actorSubject&&x.requestId===cmd.requestId);
 if(replay)return {code:replay.page===cmd.page&&sameVerse(replay.verse,cmd.verse)?
  'QURAN_PAGE_REPLAY':'QURAN_PAGE_CONFLICT',next:current};
 if(cmd.expectedRevision!==current.revision||current.revision>=Number.MAX_SAFE_INTEGER)
  return {code:'QURAN_PAGE_CONFLICT',next:current};
 const revision=current.revision+1;
 const {verse:previous,...rest}=current;
 void previous;
 const next:SharedPageRecord={...rest,page:cmd.page!,revision,
  ...(cmd.verse?{verse:cmd.verse}:{}),
  receipts:[...current.receipts.slice(-31),{
   actorSubject:cmd.actorSubject,requestId:cmd.requestId!,page:cmd.page!,revision,
   ...(cmd.verse?{verse:cmd.verse}:{})
  }]};
 return {code:'QURAN_PAGE_SET',next};
}
export function safePage(page:SharedPageRecord):SharedPage{
 return {edition:page.edition,page:page.page,revision:page.revision,
  ...(page.verse?{verse:page.verse}:{})};
}
