import {
 parseQuranAyahRegions,parseSurahIndex,quranPageMetadataUrl,quranSurahIndexUrl,
 type QuranAyahRegion,type QuranSurahInfo,
} from '@/features/student';

/** Printed-page index only; never estimate an Ayah page from verse counts. */
async function loadJson(url:string,signal?:AbortSignal):Promise<unknown>{
 const response=await fetch(url,{signal,cache:'force-cache'});
 if(!response.ok)throw Error('QURAN_SOURCE_UNAVAILABLE');
 return response.json() as Promise<unknown>;
}
export async function loadCanonicalSurahs(signal?:AbortSignal):Promise<QuranSurahInfo[]>{
 for(const fallback of [false,true]){
  try{
   const index=parseSurahIndex(await loadJson(quranSurahIndexUrl(fallback),signal));
   if(index.length===114)return index;
  }catch(error){if(signal?.aborted)throw error;}
 }
 throw Error('QURAN_SURAH_INDEX_UNAVAILABLE');
}
export async function loadCanonicalRegions(page:number,signal?:AbortSignal):
 Promise<QuranAyahRegion[]>{
 for(const fallback of [false,true]){
  try{
   const regions=parseQuranAyahRegions(
    await loadJson(quranPageMetadataUrl(page,fallback),signal));
   if(regions.length)return regions;
  }catch(error){if(signal?.aborted)throw error;}
 }
 throw Error('QURAN_PAGE_METADATA_UNAVAILABLE');
}
const compare=(a:{surah:number;ayah:number},b:{surah:number;ayah:number})=>
 a.surah-b.surah||a.ayah-b.ayah;
/** At most 11 publisher page-metadata probes. The verse must exist in the
 * located page's actual polygon list or the navigation fails closed.
 */
export async function findVerifiedVersePage(
 index:readonly QuranSurahInfo[],surah:number,ayah:number,
 getRegions:(page:number)=>Promise<QuranAyahRegion[]>=loadCanonicalRegions,
):Promise<number>{
 const info=index[surah-1];
 if(!info||info.number!==surah||!Number.isInteger(ayah)||ayah<1||ayah>info.ayahCount)
  throw Error('INVALID_QURAN_VERSE');
 const target={surah,ayah},next=index[surah];
 let low=info.pageNumber,high=next?.pageNumber??604;
 if(low>high||low<1||high>604)throw Error('INVALID_SURAH_INDEX');
 const cache=new Map<number,QuranAyahRegion[]>();
 const read=async(page:number)=>{
  let regions=cache.get(page);
  if(!regions){regions=await getRegions(page);if(!regions.length)throw Error('EMPTY_QURAN_PAGE');cache.set(page,regions);}
  return regions;
 };
 while(low<high){
  const mid=Math.floor((low+high)/2);
  const regions=await read(mid);
  const last=regions.reduce((a,b)=>compare(a,b)>0?a:b);
  if(compare(last,target)<0)low=mid+1;else high=mid;
 }
 const regions=await read(low);
 if(regions.some(r=>r.surah===surah&&r.ayah===ayah))return low;
 // A publisher may represent a cross-page verse in the preceding page too;
 // never guess a location without an exact publisher polygon match.
 if(low>info.pageNumber){
  const before=await read(low-1);
  if(before.some(r=>r.surah===surah&&r.ayah===ayah))return low-1;
 }
 throw Error('QURAN_VERSE_NOT_FOUND');
}
