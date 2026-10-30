/** Browser representation of a signed, teacher-selected Ayah. */
export type VerseSelection=Readonly<{surah:number;ayah:number}>;
export function isVerseSelection(raw:unknown):raw is VerseSelection{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const value=raw as Record<string,unknown>;
 return Object.keys(value).length===2&&
  Number.isInteger(value.surah)&&Number(value.surah)>=1&&Number(value.surah)<=114&&
  Number.isInteger(value.ayah)&&Number(value.ayah)>=1&&Number(value.ayah)<=286;
}
