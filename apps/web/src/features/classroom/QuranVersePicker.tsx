'use client';

import {useEffect,useRef,useState} from 'react';
import type {QuranSurahInfo} from '@/features/student/quranSource';
import type {VerseSelection} from './quran-verse-selection';
import {findVerifiedVersePage,loadCanonicalSurahs} from './quran-verse-navigation';
import css from './ConnectedClassroom.module.css';

type Props=Readonly<{
 enabled:boolean;
 selected:VerseSelection|null;
 onNavigate:(page:number,verse:VerseSelection)=>Promise<boolean>;
}>;
/** Compact flyout in the side of the Quran, never a second scrolling page. */
export function QuranVersePicker({enabled,selected,onNavigate}:Props){
 const details=useRef<HTMLDetailsElement>(null);
 const [index,setIndex]=useState<QuranSurahInfo[]>([]);
 const [surah,setSurah]=useState(1);
 const [ayah,setAyah]=useState(1);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  void loadCanonicalSurahs(controller.signal).then(setIndex)
   .catch(()=>{if(!controller.signal.aborted)setError('تعذّر تحميل فهرس السور.');});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(selected){setSurah(selected.surah);setAyah(selected.ayah);}
 },[selected?.surah,selected?.ayah]);
 const selectedSurah=index.find(x=>x.number===surah);
 const submit=async()=>{
  if(!enabled||busy||!selectedSurah)return;
  setBusy(true);setError('');
  try{
   const page=await findVerifiedVersePage(index,surah,ayah);
   const ok=await onNavigate(page,{surah,ayah});
   if(ok&&details.current)details.current.open=false;
   else setError('تعذّر تأكيد الآية المشتركة؛ أعد المحاولة.');
  }catch{setError('تعذّر تحديد موضع الآية من المصحف المعتمد.');}
  finally{setBusy(false);}
 };
 return <div className={css.verseNavigator}>
  <details ref={details} className={css.verseDetails}>
   <summary aria-label="اختيار السورة والآية">☷ السورة والآية</summary>
   <div className={css.versePopup} dir="rtl">
    <label htmlFor="live-verse-surah">السورة</label>
    <select id="live-verse-surah" disabled={!enabled||busy||!index.length}
      value={surah} onChange={e=>{setSurah(Number(e.target.value));setAyah(1);setError('');}}>
     {index.map(x=><option key={x.number} value={x.number}>{x.number} · {x.nameArabic}</option>)}
    </select>
    <label htmlFor="live-verse-ayah">الآية</label>
    <select id="live-verse-ayah" disabled={!enabled||busy||!selectedSurah}
      value={ayah} onChange={e=>{setAyah(Number(e.target.value));setError('');}}>
     {Array.from({length:selectedSurah?.ayahCount??0},(_,i)=>
      <option key={i+1} value={i+1}>{i+1}</option>)}
    </select>
    <button type="button" disabled={!enabled||busy||!selectedSurah}
      onClick={()=>void submit()}>{busy?'جارٍ تحديد الآية…':'انتقل وشارك الآية'}</button>
    {error&&<p role="alert">{error}</p>}
    {!enabled&&<small>التنقل المشترك متاح للشيخ بعد الانضمام.</small>}
   </div>
  </details>
 </div>;
}
