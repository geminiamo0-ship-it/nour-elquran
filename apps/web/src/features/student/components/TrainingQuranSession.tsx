'use client';
import { useEffect,useMemo,useState } from 'react';
import { ReaderPrintedPage } from './ReaderPrintedPage';
import {useStudent} from '../StudentContext';
import { QuranRecitationPlayer } from './QuranRecitationPlayer';
import { TrainingVoicePractice } from './TrainingVoicePractice';
import { quranChapterUrl,parseQuranChapter,type QuranAyahReference } from '../quranSource';
import { referencesForRange,type QuranAssignmentRange } from '../quranAssignment';
import {validTrainingPages,moveTrainingPage} from '../training-page-window';
import type { QuranTarget } from '../quranAnnotations';
import css from './TrainingWorkspace.module.css';

type Props={range:QuranAssignmentRange;title:string;onClose:()=>void;endPage?:number};

export function TrainingQuranSession({range,title,onClose,endPage}:Props){
  const lastPage=endPage??range.page;
  const validPages=validTrainingPages(range.page,lastPage);
  const [viewPage,setViewPage]=useState(range.page);
  const multiplePages=validPages&&lastPage>range.page;
  function move(direction:-1|1){
    if(!validPages)return;
    setViewPage(current=>moveTrainingPage(range.page,lastPage,current,direction));
    // A fresh printed page must not keep a playing audio/selected verse
    // that appears to belong to the previous page.
    setCurrentAudio(null);setShowAudio(false);setNoteMessage('');
  }
  const {selected:activeLearner}=useStudent();
  const cumulativeLearnerId=!activeLearner.profile.demo&&process.env.NEXT_PUBLIC_ACCOUNT_UI==='true'?
    activeLearner.profile.id:undefined;
  const refs=useMemo(()=>referencesForRange(range),[range]);
  const keys=useMemo(()=>new Set(refs.map(r=>r.surah+':'+r.ayah)),[refs]);
  const [text,setText]=useState<Map<number,string>>(new Map());
  const [loadError,setLoadError]=useState('');
  const [loading,setLoading]=useState(true);
  const [hidden,setHidden]=useState(false);
  const [revealed,setRevealed]=useState<readonly number[]>([]);
  const [active,setActive]=useState<QuranAyahReference|null>(refs[0]??null);
  const [audioToken,setAudioToken]=useState(0);
  const [showAudio,setShowAudio]=useState(false);
  const [currentAudio,setCurrentAudio]=useState<QuranAyahReference|null>(null);
  const [noteMessage,setNoteMessage]=useState('');

  useEffect(()=>{
    const controller=new AbortController();
    setText(new Map());setLoading(true);setLoadError('');
    async function load(){
      let data:unknown;
      try {
        const response=await fetch(quranChapterUrl(range.surah),{signal:controller.signal});
        if(!response.ok)throw Error('Primary Quran text unavailable');
        data=await response.json() as unknown;
      }catch(error){
        if(controller.signal.aborted)return;
        const fallback=await fetch(quranChapterUrl(range.surah,true),{signal:controller.signal});
        if(!fallback.ok)throw error;
        data=await fallback.json() as unknown;
      }
      const verses=parseQuranChapter(data,range.surah);
      if(!refs.every(ref=>verses.has(ref.ayah))) throw Error('المصدر لم يُرجع جميع آيات التدريب.');
      if(!controller.signal.aborted)setText(verses);
    }
    void load().catch(()=>{if(!controller.signal.aborted)setLoadError('تعذر تحميل النص القرآني الموثّق. لا يمكن إكمال اختبار الإخفاء الآن.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[range,refs]);

  function pick(target:QuranTarget){
    if(!keys.has(target.surah+':'+target.ayah))return;
    setActive({surah:target.surah,ayah:target.ayah});
    setNoteMessage('');
  }
  function listen(){
    setAudioToken(v=>v+1);setShowAudio(true);
  }
  const selected=active?.surah+':'+active?.ayah;
  // Hiding is a presentation-only mask on BOTH the original printed page and
  // verse list. Revealed verses must be explicitly selected, never auto-leaked.
  const practiceRevealedKeys=useMemo(()=>hidden?
    new Set(revealed.map(ayah=>range.surah+':'+ayah)):undefined,
    [hidden,revealed,range.surah]);
  if(!validPages)return <section className={css.studySession} role="alert">
    <p>نطاق صفحات الواجب غير صالح. حدّث واجباتك المنشورة قبل التدريب.</p>
    <button className={css.outlineButton} type="button" onClick={onClose}>إغلاق</button>
  </section>;
  return <section className={css.studySession} aria-label={'عارض تدريب القرآن: '+title}>
    <header className={css.studyHeader}>
      <div><span className={css.overline}>عارض المصحف نفسه · وضع التدريب</span>
        <h3>{title}</h3><p>سورة {range.surah} · الآيات {range.fromAyah}–{range.toAyah} · صفحة {viewPage}{multiplePages?' من '+range.page+' إلى '+lastPage:''}</p></div>
      <button type="button" className={css.outlineButton} onClick={onClose}>إغلاق التدريب</button>
    </header>
    {multiplePages&&<nav className={css.actions} aria-label="التنقل بين صفحات الواجب">
      <button className={css.outlineButton} type="button"
       disabled={viewPage<=range.page} onClick={()=>move(-1)}>الصفحة السابقة</button>
      <strong aria-live="polite">صفحة {viewPage} · {viewPage-range.page+1} من {lastPage-range.page+1}</strong>
      <button className={css.outlineButton} type="button"
       disabled={viewPage>=lastPage} onClick={()=>move(1)}>الصفحة التالية</button>
      <span className={css.subtle}>التنقل داخل صفحات الواجب المنشورة فقط؛
       علامات المصحف الموحد محفوظة في مصدرها الأصلي.</span>
    </nav>}
    <div className={css.studyGrid}>
      <div className={css.printedPane}>
        <ReaderPrintedPage page={viewPage} inkMode="off" color="#f6cd46"
          strokes={[]} selectedKey={currentAudio ? currentAudio.surah+':'+currentAudio.ayah : selected}
          noteKeys={new Set()} focusKeys={keys} allowedKeys={keys}
          practiceRevealedKeys={practiceRevealedKeys}
          cumulativeLearnerId={cumulativeLearnerId} includeLegacyPrivate
          onSelect={pick} onOpenNote={target=>{
            pick(target);
            setNoteMessage('الملاحظات الدائمة تُكتب في المصحف الشخصي؛ لا ننشئ نسخة ملاحظات منفصلة داخل الواجب.');
          }}
          onInkChange={()=>undefined}/>
        <span>{hidden?'المصحف الأصلي مخفي أثناء الاختبار، ويُكشف فقط الموضع الذي تختاره من القائمة بعد تحقق الخريطة القرآنية.':'الآيات المطلوبة مميزة داخل صفحة المصحف الأصلية، دون تغيير النص القرآني.'}</span>
      </div>
      <div className={css.drillPane}>
        <div className={css.rowBetween}><strong>اختبر حفظك</strong>
          <button type="button" className={css.outlineButton}
            onClick={()=>{setHidden(v=>!v);setRevealed([]);}}>
            {hidden?'إظهار الآيات':'إخفاء الآيات'}</button>
        </div>
        {loading&&<p role="status">جار تحميل نص الآيات من المصدر المعتمد…</p>}
        {loadError&&<p role="alert" className={css.error}>{loadError}</p>}
        {!loading&&!loadError&&<div className={css.verseList}>
          {refs.map(ref=>{
            const concealed=hidden&&!revealed.includes(ref.ayah);
            return <button type="button" key={ref.ayah} className={selected===ref.surah+':'+ref.ayah?css.verseActive:css.verseButton}
              onClick={()=>{setActive(ref);if(concealed)setRevealed(v=>[...v,ref.ayah]);}}
              aria-label={concealed?'كشف الآية '+ref.ayah:'تحديد الآية '+ref.ayah}>
              <span className={css.verseNumber}>({ref.surah}:{ref.ayah})</span>
              <span className={concealed?css.concealedText:css.arabicVerse}>
                {concealed?'اضغط لكشف الآية':text.get(ref.ayah)??'—'}
              </span>
            </button>;
          })}
        </div>}
        <div className={css.actions}>
          <button type="button" className={css.primaryButton} onClick={listen}
            disabled={!active}>استمع للآية المحددة</button>
          <button type="button" className={css.outlineButton}
            onClick={()=>{setHidden(true);setRevealed([]);}}>ابدأ اختبارًا جديدًا</button>
        </div>
        {noteMessage&&<p role="status" className={css.subtle}>{noteMessage}</p>}
        {showAudio&&<QuranRecitationPlayer request={{token:audioToken,scope:'ayah',page:viewPage,ayah:active}}
          pageVerses={refs} surahs={[]} onVerseChange={setCurrentAudio} onClose={()=>{setShowAudio(false);setCurrentAudio(null);}}/>}
        <TrainingVoicePractice />
      </div>
    </div>
  </section>;
}
