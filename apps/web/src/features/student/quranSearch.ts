import { parseQuranChapter, parseSurahIndex, quranSurahIndexUrl, QURAN_CHAPTER_COUNT } from './quranSource';

export type QuranSearchResult = Readonly<{ key:string; surah:number; ayah:number; page:number; text:string }>;
const MARKERS_ORIGIN = 'https://raw.githubusercontent.com/quran-ws/quran-svg/9fc0c87/mushafs/hafs/kfqc/json/markers.json';
const COMPLETE_QURAN = 'https://quran-json.risanb.com/text/uthmani/quran.json';

type Indexed = { results: QuranSearchResult[] };
let indexPromise: Promise<Indexed> | null = null;
const cache = new Map<string, QuranSearchResult[]>();

export function normalizeArabic(text:string):string {
  return text.normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu,'')
    .replace(/[ٱأإآ]/gu,'ا')
    .replace(/ى/gu,'ي')
    .replace(/ؤ/gu,'و')
    .replace(/ئ/gu,'ي')
    .replace(/\s+/gu,' ')
    .trim();
}

async function fetchJson(url: string):Promise<unknown> {
  const response=await fetch(url);
  if(!response.ok)throw Error('تعذّر تحميل المصدر القرآني: '+response.status);
  return await response.json() as unknown;
}

async function buildSearchIndex():Promise<Indexed> {
  const [chaptersData,sourceIndexData,markersData]=await Promise.all([
    fetchJson(COMPLETE_QURAN),
    fetchJson(quranSurahIndexUrl(true)),
    fetchJson(MARKERS_ORIGIN)
  ]);
  if(!Array.isArray(chaptersData) || chaptersData.length!==QURAN_CHAPTER_COUNT)
    throw Error('ملف نص القرآن الكامل غير مكتمل.');
  const surahs=parseSurahIndex(sourceIndexData);
  if(surahs.length!==114 || surahs.reduce((n,s)=>n+s.ayahCount,0)!==6236)
    throw Error('فهرس السور لا يطابق رواية حفص.');
  if(!Array.isArray(markersData) || markersData.length!==6236)
    throw Error('فهرس صفحات الآيات غير مكتمل.');
  const pages=new Map<number,number>();
  for(const row of markersData) {
    if(!row || typeof row!=='object')throw Error('فهرس الآيات تالف.');
    const entry=row as {ayah?:unknown;page?:unknown};
    if(!Number.isInteger(entry.ayah) || !Number.isInteger(entry.page) ||
      Number(entry.ayah)<1 || Number(entry.ayah)>6236 ||
      Number(entry.page)<1 || Number(entry.page)>604)
      throw Error('رقم آية أو صفحة غير صالح.');
    pages.set(Number(entry.ayah),Number(entry.page));
  }
  if(pages.size!==6236)throw Error('آيات مفقودة أو مكررة في فهرس الصفحات.');
  const results:QuranSearchResult[]=[];
  let global=0;
  for(let s=1;s<=114;s++){
    const chapter=chaptersData[s-1];
    const verses=parseQuranChapter(chapter,s);
    if(verses.size!==surahs[s-1]!.ayahCount)
      throw Error('نص السورة لا يتطابق مع عدد آياتها: '+s);
    for(let ayah=1;ayah<=surahs[s-1]!.ayahCount;ayah++){
      global++;
      const page=pages.get(global),text=verses.get(ayah);
      if(!page||!text)throw Error('مرجع آية ناقص: '+s+':'+ayah);
      results.push({key:s+':'+ayah,surah:s,ayah,page,text});
    }
  }
  if(results.length!==6236)throw Error('مصدر النص القرآني غير مكتمل.');
  return {results};
}

export async function searchFullQuran(query:string,limit=80):Promise<{matches:QuranSearchResult[];total:number}> {
  const normalized=normalizeArabic(query);
  if(normalized.length<2)return {matches:[],total:0};
  if(!indexPromise)indexPromise=buildSearchIndex().catch(e=>{indexPromise=null;throw e;});
  const data=await indexPromise;
  if(!cache.has(normalized)){
    const match=data.results.filter(x=>x.key===query.trim()||normalizeArabic(x.text).includes(normalized));
    cache.set(normalized,match);
    if(cache.size>12)cache.delete(cache.keys().next().value!);
  }
  const found=cache.get(normalized)!;
  return {matches:found.slice(0,Math.max(1,Math.min(100,limit))),total:found.length};
}
