'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ReaderIcon } from './ReaderIcon';
import { isQuranDoubleTap, type QuranTap } from '../quranInteraction';
import { QuranRecitationPlayer } from './QuranRecitationPlayer';
import { quranAudioKey, type QuranAudioRequest, type QuranAudioScope } from '../quranReciters';
import type { QuranAyahReference } from '../quranSource';
import { useStudent } from '../StudentContext';
import {
  clampQuranPage, parseQuranAyahRegions, parseQuranChapter,
  quranChapterUrl, quranPageMetadataUrl, quranReferenceKey,
  quranSurahIndexUrl, parseSurahIndex, QURAN_PAGE_COUNT,
  type QuranAyahRegion, type QuranSurahInfo, type QuranViewMode,
} from '../quranSource';
import {
  validTarget, visibleAnnotations, notePreview, targetKey, type QuranTarget,
  type QuranAnnotation, type QuranInkStroke,
} from '../quranAnnotations';
import { ReaderPrintedPage } from './ReaderPrintedPage';
import { getVisibleSpread, type ReaderPageMode } from '../quranReaderLayout';
import type { InkMode } from './QuranInk';
import { QuranSearchPanel } from './QuranSearchPanel';
import css from './MadinahReader.module.css';

async function readJson(primary:string,fallback:string,signal:AbortSignal):Promise<unknown> {
  try {
    const response=await fetch(primary,{signal});
    if(!response.ok)throw Error('Main Quran source unavailable');
    return await response.json() as unknown;
  } catch(e) {
    if(signal.aborted)throw e;
    const response=await fetch(fallback,{signal});
    if(!response.ok)throw Error('تعذّر الوصول إلى بيانات المصحف من المصدر المعتمد.');
    return await response.json() as unknown;
  }
}
function refOf(region:QuranAyahRegion):string {return quranReferenceKey(region);}
const palette=['#f6cd46','#86c5a8','#ec99a4','#81b5e4','#d2a7df'];

export function MadinahReader() {
  const {selected}=useStudent();
  const [page,setPage]=useState(1);
  const [pageEntry,setPageEntry]=useState('1');
  const [mode,setMode]=useState<QuranViewMode>('madinah');
  const [regions,setRegions]=useState<QuranAyahRegion[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [texts,setTexts]=useState<Record<string,string>>({});
  const [surahs,setSurahs]=useState<QuranSurahInfo[]>([]);
  const [indexError,setIndexError]=useState(false);
  const [selectedTarget,setSelectedTarget]=useState<QuranTarget|null>(null);
  const [pendingKey,setPendingKey]=useState<string|null>(null);
  const [notes,setNotes]=useState<QuranAnnotation[]>([]);
  const [draft,setDraft]=useState('');
  const [marked,setMarked]=useState<Record<string,string>>({});
  const [color,setColor]=useState(palette[0]!);
  const [inkMode,setInkMode]=useState<InkMode>('off');
  const [inkByPage,setInkByPage]=useState<Record<number,QuranInkStroke[]>>({});
  const [redoByPage,setRedoByPage]=useState<Record<number,QuranInkStroke[]>>({});
  const [showSearch,setShowSearch]=useState(false);
  const [showNotes,setShowNotes]=useState(false);
  const [showAside,setShowAside]=useState(false);
  const [showIndex,setShowIndex]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [indexTab,setIndexTab]=useState<'surahs'|'juz'|'marks'|'notes'>('surahs');
  const [bookmarks,setBookmarks]=useState<number[]>([]);
  const [spreadMode,setSpreadMode]=useState<ReaderPageMode>('auto');
  const [compactDevice,setCompactDevice]=useState(false);
  const [turnMode,setTurnMode]=useState<'swipe'|'buttons'>('swipe');
  const [immersive,setImmersive]=useState(false);
  const [hideChrome,setHideChrome]=useState(false);
  const [fontSize,setFontSize]=useState(27);
  const [localSearch,setLocalSearch]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [savedNotice,setSavedNotice]=useState('');
  const [audioOpen,setAudioOpen]=useState(false);
  const [audioRequest,setAudioRequest]=useState<QuranAudioRequest|null>(null);
  const [audioVerse,setAudioVerse]=useState<QuranAyahReference|null>(null);
  const startTouch=useRef<{x:number;y:number}|null>(null);
  const lastVerseTap=useRef<QuranTap|null>(null);
  const [inkPaletteOpen,setInkPaletteOpen]=useState(false);

  useEffect(()=>{
    const update=()=>setCompactDevice(window.innerWidth<900);
    update();window.addEventListener('resize',update);
    if(window.matchMedia('(max-width:700px)').matches){setImmersive(true);setHideChrome(false);setShowAside(false);}
    return ()=>window.removeEventListener('resize',update);
  },[]);
  useEffect(()=>{
    if(!immersive)return;
    const old=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{document.body.style.overflow=old;};
  },[immersive]);

  useEffect(()=>{
    const controller=new AbortController();
    void readJson(quranSurahIndexUrl(),quranSurahIndexUrl(true),controller.signal)
      .then(data=>{
        if(controller.signal.aborted)return;
        const parsed=parseSurahIndex(data);
        if(parsed.length!==114)throw Error('Invalid surah index');
        setSurahs(parsed);setIndexError(false);
      }).catch(()=>{if(!controller.signal.aborted)setIndexError(true);});
    return ()=>controller.abort();
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');setRegions([]);setSelectedTarget(null);
    void readJson(quranPageMetadataUrl(page),quranPageMetadataUrl(page,true),controller.signal)
      .then(data=>{
        if(controller.signal.aborted)return;
        const parsed=parseQuranAyahRegions(data);
        if(parsed.length===0)throw Error('لم تُرجع خريطة الصفحة آيات موثقة.');
        setRegions(parsed);
      }).catch(e=>{
        if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذّر تحميل مواضع آيات الصفحة');
      }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[page,refresh]);

  useEffect(()=>{
    if(!pendingKey||loading||!regions.length)return;
    const match=regions.find(r=>refOf(r)===pendingKey);
    if(match){
      const target:QuranTarget={page,surah:match.surah,ayah:match.ayah,wordIndex:null};
      setSelectedTarget(target);
      const original=notes.find(n=>n.learnerId===selected.profile.id&&targetKey(n.target)===targetKey(target));
      setDraft(original?.text??'');
      setShowAside(true);setShowNotes(false);setShowIndex(false);setShowSettings(false);
      if(mode==='ayah'){
        window.requestAnimationFrame(()=>document.getElementById('quran-ayah-'+pendingKey.replace(':','-'))?.scrollIntoView({block:'center',behavior:'smooth'}));
      }
    }
    setPendingKey(null);
  },[pendingKey,regions,loading,page,mode,notes,selected.profile.id]);

  useEffect(()=>{
    if(mode!=='ayah'||regions.length===0)return;
    const controller=new AbortController();
    const chapters=[...new Set(regions.map(r=>r.surah))];
    void Promise.all(chapters.map(async surah=>{
      const data=await readJson(quranChapterUrl(surah),quranChapterUrl(surah,true),controller.signal);
      return [...parseQuranChapter(data,surah)].map(([ayah,text])=>[surah+':'+ayah,text] as const);
    })).then(groups=>{
      if(!controller.signal.aborted)setTexts(prev=>Object.assign({},prev,...groups.map(Object.fromEntries)));
    }).catch(()=>{if(!controller.signal.aborted)setError('تعذّر تحميل نص الآيات؛ يمكن متابعة المصحف المصوّر.');});
    return ()=>controller.abort();
  },[mode,regions]);

  const visible=useMemo(()=>visibleAnnotations(notes,selected.profile.id),[notes,selected.profile.id]);
  const noteByKey=useMemo(()=>new Set(visible.map(n=>n.target.surah+':'+n.target.ayah)),[visible]);
  const filtered=useMemo(()=>{
    const q=localSearch.trim();
    return q?regions.filter(r=>refOf(r).includes(q)||(texts[refOf(r)]??'').includes(q)):regions;
  },[localSearch,regions,texts]);

  function go(n:number,focus?:string) {
    const next=clampQuranPage(n);
    setPage(next);setPageEntry(String(next));setLocalSearch('');lastVerseTap.current=null;
    setPendingKey(focus??null);
  }
  function handleVerseTap(target:QuranTarget) {
    if(!validTarget(target))return;
    const key=targetKey(target);
    const now=Date.now();
    if(isQuranDoubleTap(lastVerseTap.current,key,now)) {
      lastVerseTap.current=null;
      selectTarget(target);
      return;
    }
    lastVerseTap.current={key,at:now};
    setSelectedTarget(target);
    setShowAside(false);
  }
  function selectTarget(target:QuranTarget) {
    if(!validTarget(target))return;
    setSelectedTarget(target);
    const old=visible.find(n=>n.type==='private'&&targetKey(n.target)===targetKey(target));
    lastVerseTap.current=null;
    setDraft(old?.text??'');setShowAside(true);setShowSearch(false);setShowNotes(false);setShowIndex(false);setShowSettings(false);setSavedNotice('');
  }
  function saveNote() {
    if(!selectedTarget||!validTarget(selectedTarget))return;
    const text=notePreview(draft),key=targetKey(selectedTarget);
    setNotes(prev=>{
      const remaining=prev.filter(n=>!(n.learnerId===selected.profile.id&&n.type==='private'&&targetKey(n.target)===key));
      if(!text)return remaining;
      return [...remaining,{
        id:'local-'+Date.now(),learnerId:selected.profile.id,type:'private',published:false,
        authorLabel:'ملاحظتي الشخصية',target:selectedTarget,text,color,createdAt:new Date().toISOString()
      }];
    });
    setSavedNotice(text?'اتحفظت الملاحظة مؤقتًا في جلسة القراءة.':'اتمسحت الملاحظة المؤقتة.');
  }
  function changeInkFor(targetPage:number,strokes:QuranInkStroke[]) {
    setInkByPage(prev=>({...prev,[targetPage]:strokes}));
    setRedoByPage(prev=>({...prev,[targetPage]:[]}));
  }
  function undoInk() {
    const current=inkByPage[page]??[];
    if(!current.length)return;
    const last=current[current.length-1]!;
    setInkByPage(prev=>({...prev,[page]:current.slice(0,-1)}));
    setRedoByPage(prev=>({...prev,[page]:[...(prev[page]??[]),last]}));
  }
  function redoInk() {
    const redo=redoByPage[page]??[],item=redo[redo.length-1];
    if(!item)return;
    setInkByPage(prev=>({...prev,[page]:[...(prev[page]??[]),item]}));
    setRedoByPage(prev=>({...prev,[page]:redo.slice(0,-1)}));
  }
  const selectedKey=selectedTarget?targetKey(selectedTarget):null;
  const activeSurah=surahs.filter(s=>s.pageNumber<=page).at(-1)?.number??'';
  const spreadPages=getVisibleSpread(page,spreadMode,compactDevice);
  function openDrawer(kind:'index'|'notes'|'search'|'settings'|'ayah') {
    setShowAside(true);setShowIndex(kind==='index');setShowNotes(kind==='notes');
    setShowSearch(kind==='search');setShowSettings(kind==='settings');setHideChrome(false);
  }
  function openRecitation(scope: QuranAudioScope, ayah: QuranAyahReference|null = null) {
    setAudioOpen(true);
    setAudioRequest(prev => ({token:(prev?.token??0)+1,scope,page,ayah}));
    setShowAside(false);
  }
  function chooseTool(tool:InkMode) {
    lastVerseTap.current=null;
    setInkMode(tool);setHideChrome(false);setShowAside(false);
    setInkPaletteOpen(tool!=='off');
  }

  return <div className={[css.reader,immersive?css.immersive:''].join(' ')} dir="rtl">
    <header className={css.readerHeader}>
      <div className={css.identity}>
        <span className={css.brandMark}><ReaderIcon name="book" /></span>
        <div><strong>مصحف نور القرآن</strong><small>مصحف المدينة · حفص عن عاصم · نص قرآني موثّق</small></div>
      </div>
      <div className={css.headerActions}>
        <label htmlFor="quran-surah-select" className={css.visuallyHidden}>الانتقال إلى سورة</label>
        <select id="quran-surah-select" className={css.surahSelect} value={activeSurah}
          disabled={!surahs.length} onChange={e=>{
            const chosen=surahs.find(x=>x.number===Number(e.target.value));
            if(chosen)go(chosen.pageNumber);
          }}>
          {!surahs.length?<option value="">السور</option>:
            surahs.map(x=><option key={x.number} value={x.number}>{x.nameArabic}</option>)}
        </select>
        <button type="button" className={css.iconButton} aria-label="فتح فهرس المصحف" title="الفهرس"
          onClick={()=>openDrawer('index')}><ReaderIcon name="index" /></button>
        <button type="button" className={css.iconButton} aria-label="إعدادات القراءة" title="الإعدادات"
          onClick={()=>openDrawer('settings')}><ReaderIcon name="settings" /></button>
        <button type="button" className={css.exitButton} onClick={()=>{if(compactDevice&&immersive){window.location.assign('/student');return;}else setImmersive(v=>!v);setShowAside(false);}}>
          <span className={css.exitLabel}>{immersive?'الخروج من وضع القراءة':'وضع القراءة'}</span><span className={css.exitGlyph} aria-hidden="true">↗</span>
        </button>
      </div>
    </header>
    <nav className={[css.toolbar,hideChrome?css.toolbarCollapsed:''].join(' ')} aria-label="أدوات المصحف">
      <div className={css.inkAnchor}>
        <button type="button" className={inkMode==='marker'?css.activeTool:css.tool}
          aria-pressed={inkMode==='marker'} aria-expanded={inkPaletteOpen}
          aria-controls="quran-ink-palette" title="ماركر"
          onClick={()=>chooseTool(inkMode==='marker'?'off':'marker')}><ReaderIcon name="marker" /><span>ماركر</span></button>
        <button type="button" className={inkMode==='pen'?css.activeTool:css.tool}
          aria-pressed={inkMode==='pen'} aria-expanded={inkPaletteOpen}
          aria-controls="quran-ink-palette" title="قلم"
          onClick={()=>chooseTool(inkMode==='pen'?'off':'pen')}><ReaderIcon name="pen" /><span>قلم</span></button>
        {inkPaletteOpen && !hideChrome && <div className={css.inkPalette} id="quran-ink-palette"
          role="group" aria-label="ألوان وأدوات الرسم">
          <button type="button" className={css.paletteIcon} aria-label="إغلاق لوحة القلم"
            title="إخفاء لوحة القلم" onClick={()=>setInkPaletteOpen(false)}>×</button>
          <div className={css.paletteDivider} />
          {palette.map(c=><button key={c} type="button" className={css.colorDot}
            style={{background:c}} aria-label={'لون '+c} aria-pressed={color===c}
            title={'لون '+c} onClick={()=>setColor(c)}/>)}
          <div className={css.paletteDivider} />
          <button type="button" className={css.paletteIcon} title="ممحاة" aria-label="ممحاة"
            aria-pressed={inkMode==='eraser'} onClick={()=>chooseTool('eraser')}>⌫</button>
          <button type="button" className={css.paletteIcon} title="تراجع" aria-label="تراجع"
            disabled={!(inkByPage[page]?.length)} onClick={undoInk}>↶</button>
          <button type="button" className={css.paletteIcon} title="إعادة" aria-label="إعادة"
            disabled={!(redoByPage[page]?.length)} onClick={redoInk}>↷</button>
          <button type="button" className={css.paletteIcon} title="العودة للتصفح" aria-label="العودة للتصفح"
            onClick={()=>chooseTool('off')}>☝</button>
        </div>}
      </div>
      <button type="button" className={css.tool} onClick={()=>openDrawer('search')}
        aria-label="بحث شامل في المصحف" title="بحث شامل"><ReaderIcon name="search" /><span>بحث شامل</span></button>
      <button type="button" className={css.tool} onClick={()=>openDrawer('notes')} title="الملاحظات">
        <ReaderIcon name="notes" /><span>جميع ملاحظاتي ({visible.length})</span></button>
      <button type="button" className={css.tool} onClick={()=>{setMode(mode==='madinah'?'ayah':'madinah');setInkMode('off');}}
        title="آية بآية" aria-pressed={mode==='ayah'}><ReaderIcon name="ayah" /><span>آية بآية</span></button>
      <button type="button" className={css.tool} onClick={()=>openRecitation('page',selectedTarget)}
        title="التلاوة" aria-label="فتح مشغل التلاوة">
        <ReaderIcon name="play" /><span>تلاوة</span></button>
      <button type="button" className={css.iconButton} onClick={()=>setHideChrome(v=>!v)}
        aria-label={hideChrome?'إظهار الأدوات':'إخفاء الأدوات'}
        aria-expanded={!hideChrome} title={hideChrome?'إظهار الأدوات':'إخفاء الأدوات'}>
        <span className={css.toolsToggleLabel}>{hideChrome?'إظهار الأدوات':'إخفاء الأدوات'}</span>
        <span className={css.toolsToggleGlyph} aria-hidden="true">{hideChrome?'⌄':'⌃'}</span>
      </button>
    </nav>

    {error && <div role="alert" className={css.warning}>{error}
      <button type="button" onClick={()=>setRefresh(x=>x+1)}>إعادة المحاولة</button>
    </div>}
    {audioOpen && audioRequest && <QuranRecitationPlayer
      request={audioRequest} pageVerses={regions} surahs={surahs}
      onVerseChange={setAudioVerse} onClose={()=>{setAudioOpen(false);setAudioVerse(null);}} />}
    <div className={css.grid}>
      <main className={css.bookStage} aria-label="صفحات مصحف المدينة">
        {mode==='madinah' ?
          <div className={spreadPages.length===2?css.doubleBook:css.singleBook} data-spread-pages={spreadPages.join(",")}>
            {spreadPages.map((leaf,slot)=><div key={'page-slot-'+slot} className={css.leaf}
              onTouchStart={e=>{startTouch.current={x:e.touches[0]?.clientX??0,y:e.touches[0]?.clientY??0};}}
              onTouchEnd={e=>{
                const start=startTouch.current,end=e.changedTouches[0];startTouch.current=null;
                if(!start||!end||inkMode!=='off'||turnMode!=='swipe')return;
                const dx=end.clientX-start.x,dy=end.clientY-start.y;
                if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.6)go(page+(dx>0?1:-1));
              }}>
              <ReaderPrintedPage page={leaf} color={color} inkMode={inkMode}
                strokes={inkByPage[leaf]??[]} onInkChange={changeInkFor}
                selectedKey={audioVerse ? quranAudioKey(audioVerse) : selectedKey} noteKeys={noteByKey}
                onSelect={handleVerseTap} onOpenNote={selectTarget}/>
              </div>)}
          </div>:
          <div className={css.ayahDisplay} aria-label="عرض القرآن آية بآية">
            {loading?<p>جار تحميل آيات الصفحة…</p>:regions.length===0?<p>لا توجد بيانات آيات متاحة.</p>:
              regions.map(region=>{
                const key=refOf(region),text=texts[key];
                let wordIndex=0;
                return <div id={'quran-ayah-'+key.replace(':','-')} key={key}
                  className={css.ayahRow} style={{fontSize}}>
                  <button type="button" className={css.ayahRef} style={{background:marked[key]}}
                    aria-pressed={selectedKey===key}
                    onClick={()=>handleVerseTap({page,surah:region.surah,ayah:region.ayah,wordIndex:null})}>
                    ﴿{key}﴾{noteByKey.has(key)?' ●':''}
                  </button>{' '}
                  {text?text.split(/(\s+)/u).map((part,i)=>{
                    if(!part.trim())return <span key={i}>{part}</span>;
                    wordIndex++;
                    const k=key+':w'+wordIndex,n=wordIndex;
                    return <button key={i} type="button" className={css.word}
                      style={{background:marked[k]}} aria-pressed={selectedKey===k}
                      onClick={()=>handleVerseTap({page,surah:region.surah,ayah:region.ayah,wordIndex:n})}>{part}</button>;
                  }):<span>جار تحميل النص العثماني…</span>}
                </div>;
              })}
          </div>}
      </main>
      {showAside && <aside className={css.sidebar} aria-label="قائمة المصحف" role="dialog" aria-modal={false}>
        <div className={css.sheetHeading}>
          <strong>{showSettings?'إعدادات القراءة':showSearch?'البحث في المصحف':showNotes?'جميع ملاحظاتي':showIndex?'فهرس المصحف':selectedTarget?'ملاحظة الآية':'آيات الصفحة'}</strong>
          <button type="button" className={css.smallButton} aria-label="إغلاق لوحة الملاحظات"
            onClick={()=>{setShowAside(false);setShowSearch(false);setShowNotes(false);setShowSettings(false);setShowIndex(false);}}>إغلاق ×</button>
        </div>
        {showSettings ? <div className={css.settingsPanel}>
          <fieldset><legend>عرض الصفحة</legend>
            {(['auto','single','double'] as ReaderPageMode[]).map(m=><label key={m}>
              <input type="radio" name="reader-page-mode" value={m} checked={spreadMode===m}
                onChange={()=>setSpreadMode(m)}/>
              {m==='auto'?'تلقائي':m==='single'?'صفحة واحدة':'صفحتان (شاشة كبيرة)'}
            </label>)}
          </fieldset>
          <fieldset><legend>حركة تقليب الصفحة</legend>
            <label><input type="radio" checked={turnMode==='swipe'} onChange={()=>setTurnMode('swipe')}/> السحب والأزرار</label>
            <label><input type="radio" checked={turnMode==='buttons'} onChange={()=>setTurnMode('buttons')}/> الأزرار فقط</label>
          </fieldset>
          <label htmlFor="quran-font-size">حجم خط وضع «آية بآية»</label>
          <input id="quran-font-size" type="range" min="22" max="42" step="2" value={fontSize}
            onChange={e=>setFontSize(Number(e.target.value))}/>
          <div className={css.info}><strong>التلاوة:</strong> اختر «تلاوة» من شريط المصحف للاستماع المباشر للقراء. التفسير يحتاج مصدرًا مرخّصًا مستقلًا.</div>
          {indexError&&<p role="status">فهرس السور غير متاح مؤقتًا؛ استخدم رقم الصفحة.</p>}
        </div> : showSearch ? <QuranSearchPanel onNavigate={(target,key)=>{
          go(target,key);setShowSearch(false);setMode('ayah');
        }}/> : showNotes ? <div className={css.noteList} aria-label="جميع ملاحظاتي">
          {visible.length===0?<p>لا توجد ملاحظات شخصية محفوظة في هذه الجلسة.</p>:
            visible.map(n=><button key={n.id} type="button" className={css.noteJump}
              onClick={()=>{go(n.target.page,n.target.surah+':'+n.target.ayah);setMode('ayah');}}>
              <strong>{n.type==='teacher'?'ملاحظة الشيخ':'ملاحظتي'} · {targetKey(n.target)} · ص {n.target.page}</strong>
              <span>{n.text}</span></button>)}
        </div> : showIndex ? <>
          <div className={css.tabs} role="group" aria-label="أقسام فهرس المصحف">
            {([{id:'surahs',text:'السور'},{id:'juz',text:'الأجزاء'},{id:'marks',text:'العلامات'},{id:'notes',text:'ملاحظاتي'}] as const)
              .map(t=><button key={t.id} type="button" aria-pressed={indexTab===t.id}
                className={indexTab===t.id?css.activeTab:css.tab} onClick={()=>setIndexTab(t.id)}>{t.text}</button>)}
          </div>
          {indexTab==='surahs' ? <div className={css.indexRows}>
            {surahs.map(s=><button key={s.number} type="button" onClick={()=>{go(s.pageNumber);setShowAside(false);}}>
              <span>{s.number} · {s.nameArabic}</span><small>ص {s.pageNumber}</small>
            </button>)}
            {!surahs.length&&<p>جار تحميل فهرس السور من المصدر المعتمد…</p>}
          </div> : indexTab==='juz'? <p className={css.info}>بدايات الأجزاء تحتاج فهرس صفحات مستقلًا موثقًا؛ التنقل بالسور والصفحات متاح الآن.</p>:
          indexTab==='marks'?<div className={css.indexRows}>
            <button type="button" onClick={()=>setBookmarks(prev=>prev.includes(page)?prev.filter(n=>n!==page):[...prev,page].sort((a,b)=>a-b))}>
              {bookmarks.includes(page)?'إزالة علامة الصفحة الحالية':'إضافة علامة للصفحة الحالية'} · {page}
            </button>
            {bookmarks.map(n=><button type="button" key={n} onClick={()=>{go(n);setShowAside(false);}}>صفحة {n}</button>)}
          </div>:<div className={css.noteList}>
            {visible.length===0?<p>لا توجد ملاحظات في هذه الجلسة.</p>:
              visible.map(n=><button key={n.id} className={css.noteJump} type="button"
                onClick={()=>{go(n.target.page,n.target.surah+':'+n.target.ayah);setMode('ayah');}}>
                {targetKey(n.target)} · ص {n.target.page} — {n.text}</button>)}
          </div>}
        </> : <>
          {selectedTarget && <div className={css.note}>
            <h3>آية {selectedTarget.surah}:{selectedTarget.ayah}
              {selectedTarget.wordIndex!==null?' · الكلمة '+selectedTarget.wordIndex:''}</h3>
            <div className={css.contextTools}>
              <button type="button" className={css.smallButton} onClick={()=>openRecitation('ayah',selectedTarget)}>
                <ReaderIcon name="play" /> استمع لهذه الآية
              </button>
              <button type="button" className={css.smallButton} onClick={()=>setMarked(prev=>({
                ...prev,[targetKey(selectedTarget)]:color
              }))}>تظليل هذا الموضع</button>
              <button type="button" className={css.smallButton} onClick={()=>setMarked(prev=>{
                const next={...prev};delete next[targetKey(selectedTarget)];return next;
              })}>إزالة التظليل</button>
            </div>
            <label htmlFor="quran-note">ملاحظة على الموضع المحدد (حتى 500 حرف)</label>
            <textarea id="quran-note" maxLength={500} rows={4} value={draft}
              onChange={e=>setDraft(e.target.value)}/>
            <button type="button" className={css.primaryButton} onClick={saveNote}>حفظ الملاحظة</button>
            {savedNotice&&<p role="status" className={css.saveNotice}>{savedNotice}</p>}
          </div>}
          {!selectedTarget&&<><h3>آيات هذه الصفحة</h3>
          <label htmlFor="quran-page-search">البحث في الصفحة الحالية</label>
          <input id="quran-page-search" value={localSearch} onChange={e=>setLocalSearch(e.target.value)}
            placeholder="رقم الآية أو نصها"/>
          <div className={css.ayahLinks} aria-label="اختيار آية من الصفحة">
            {filtered.map(region=>{
              const key=refOf(region);
              return <button type="button" key={key} className={selectedKey===key?css.activeTab:css.tab}
                aria-pressed={selectedKey===key}
                onClick={()=>selectTarget({page,surah:region.surah,ayah:region.ayah,wordIndex:null})}>
                {key}{noteByKey.has(key)?' ●':''}</button>;
            })}
          </div>
          {visible.filter(n=>n.target.page===page).map(n=><button key={n.id} className={css.noteJump} type="button"
            onClick={()=>selectTarget(n.target)}>{targetKey(n.target)} · {n.text}</button>)}</>}
          {selectedTarget&&<button type="button" className={css.smallButton} onClick={()=>setSelectedTarget(null)}>اختيار آية أخرى</button>}
        </>}
        <p className={css.info}>الملاحظات والرسم في هذه النسخة محليان ومؤقتان، وليسا متزامنين مع الشيخ أو حساب الطالب بعد.</p>
      </aside>}
    </div>
    <footer className={css.readerFoot} aria-label="شريط التنقل بين صفحات المصحف">
      <button type="button" className={css.navButton} aria-label="تقليب إلى الصفحة السابقة"
        disabled={page===1} onClick={()=>go(page-1)}>السابق</button>
      <button type="button" className={css.navButton} aria-label="الصفحة السابقة"
        disabled={page===1} onClick={()=>go(page-1)} title="الصفحة السابقة">‹</button>
      <form className={css.pageForm} onSubmit={e=>{
        e.preventDefault();const n=Number(pageEntry);
        if(Number.isInteger(n)&&n>=1&&n<=QURAN_PAGE_COUNT)go(n);
      }}>
        <label htmlFor="quran-page-input">الصفحة</label>
        <input id="quran-page-input" type="number" dir="ltr" min="1" max="604" step="1"
          value={pageEntry} onChange={e=>setPageEntry(e.target.value)}/>
        <span>من 604</span><button type="submit">انتقال</button>
      </form>
      <button type="button" className={css.navButton} aria-label="الصفحة التالية"
        disabled={page===604} onClick={()=>go(page+1)} title="الصفحة التالية">›</button>
      <button type="button" className={css.navButton} aria-label="تقليب إلى الصفحة التالية"
        disabled={page===604} onClick={()=>go(page+1)}>التالي</button>
      <button type="button" className={css.footerNotes} onClick={()=>openDrawer('notes')}>ملاحظاتي</button>
    </footer>
  </div>;
}
