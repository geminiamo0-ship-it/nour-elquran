'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudent } from '../StudentContext';
import {
  clampQuranPage, parseQuranAyahRegions, parseQuranChapter, pageName,
  quranChapterUrl, quranPageMetadataUrl, quranReferenceKey,
  quranSurahIndexUrl, parseSurahIndex, QURAN_PAGE_COUNT,
  type QuranAyahRegion, type QuranSurahInfo, type QuranViewMode,
} from '../quranSource';
import {
  validTarget, visibleAnnotations, notePreview, targetKey, type QuranTarget,
  type QuranAnnotation, type QuranInkStroke,
} from '../quranAnnotations';
import { SmoothMadinahPage } from './SmoothMadinahPage';
import { QuranInk, type InkMode } from './QuranInk';
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
  const [showAside,setShowAside]=useState(true);
  const [immersive,setImmersive]=useState(false);
  const [hideChrome,setHideChrome]=useState(false);
  const [fontSize,setFontSize]=useState(27);
  const [localSearch,setLocalSearch]=useState('');
  const [refresh,setRefresh]=useState(0);
  const startTouch=useRef<{x:number;y:number}|null>(null);

  useEffect(()=>{
    if(window.matchMedia('(max-width:700px)').matches){setImmersive(true);setHideChrome(true);setShowAside(false);}
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
      setShowAside(true);setShowNotes(false);
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
    setPage(next);setPageEntry(String(next));setLocalSearch('');
    setPendingKey(focus??null);
  }
  function selectTarget(target:QuranTarget) {
    if(!validTarget(target))return;
    setSelectedTarget(target);
    const old=visible.find(n=>n.type==='private'&&targetKey(n.target)===targetKey(target));
    setDraft(old?.text??'');setShowAside(true);
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
  }
  function changeInk(strokes:QuranInkStroke[]) {
    setInkByPage(prev=>({...prev,[page]:strokes}));setRedoByPage(prev=>({...prev,[page]:[]}));
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

  return <div className={[css.reader,immersive?css.immersive:'',hideChrome&&immersive?css.readingOnly:''].join(' ')}>
    <div className={css.readerHeader}>
      <strong>مصحف المدينة · حفص عن عاصم</strong>
      <div className={css.headerActions}>
        {immersive&&<button type="button" className={css.button} onClick={()=>setHideChrome(v=>!v)}>
          {hideChrome?'إظهار الأدوات':'إخفاء الأدوات'}</button>}
        <button type="button" className={css.button} onClick={()=>{setImmersive(v=>!v);setHideChrome(false);}}>
          {immersive?'الخروج من وضع القراءة':'وضع القراءة'}</button>
      </div>
    </div>
    <div className={css.chrome}>
      <div className={css.toolbar} role="group" aria-label="أوضاع المصحف">
        <button type="button" className={mode==='madinah'?css.active:css.button}
          aria-pressed={mode==='madinah'} onClick={()=>setMode('madinah')}>مصحف المدينة</button>
        <button type="button" className={mode==='ayah'?css.active:css.button}
          aria-pressed={mode==='ayah'} onClick={()=>{setMode('ayah');setInkMode('off');}}>آية بآية</button>
        <button type="button" className={showSearch?css.active:css.button}
          onClick={()=>{setShowSearch(v=>!v);setShowAside(true);}}>بحث شامل</button>
        <button type="button" className={showNotes?css.active:css.button}
          onClick={()=>{setShowNotes(v=>!v);setShowAside(true);}}>جميع ملاحظاتي ({visible.length})</button>
        <button type="button" className={css.button}
          onClick={()=>setShowAside(v=>!v)}>{showAside?'إخفاء القائمة':'الآيات والملاحظات'}</button>
        {mode==='ayah'&&<><label htmlFor="quran-font-size">حجم النص</label>
          <input id="quran-font-size" type="range" min="22" max="42" step="2" value={fontSize}
            onChange={e=>setFontSize(Number(e.target.value))}/></>}
      </div>
      <div className={css.toolbar} role="group" aria-label="أدوات القلم والماركر">
        {(['off','pen','marker','eraser'] as InkMode[]).map((tool)=>
          <button key={tool} type="button" disabled={mode!=='madinah'} aria-pressed={inkMode===tool}
            className={inkMode===tool?css.active:css.button} onClick={()=>setInkMode(tool)}>
            {({off:'تصفح',pen:'قلم',marker:'ماركر',eraser:'ممحاة'} as const)[tool]}</button>)}
        <div className={css.colors} aria-label="ألوان التحديد">
          {palette.map(c=><button key={c} type="button" className={css.colorDot}
            style={{background:c}} aria-label={'لون '+c} aria-pressed={color===c}
            onClick={()=>setColor(c)}/>)}
        </div>
        <button type="button" className={css.button} onClick={undoInk}
          disabled={!(inkByPage[page]?.length)}>تراجع</button>
        <button type="button" className={css.button} onClick={redoInk}
          disabled={!(redoByPage[page]?.length)}>إعادة</button>
      </div>
      <form className={css.navigation} onSubmit={e=>{
        e.preventDefault();const n=Number(pageEntry);
        if(Number.isInteger(n)&&n>=1&&n<=QURAN_PAGE_COUNT)go(n);
      }}>
        <button type="button" className={css.button} disabled={page===1}
          aria-label="الصفحة السابقة" onClick={()=>go(page-1)}>السابق</button>
        <label htmlFor="quran-page-input">الصفحة</label>
        <input id="quran-page-input" type="number" min="1" max="604" step="1"
          value={pageEntry} onChange={e=>setPageEntry(e.target.value)} dir="ltr"/>
        <span>من {QURAN_PAGE_COUNT}</span>
        <button type="submit" className={css.button}>انتقال</button>
        <button type="button" className={css.button} disabled={page===QURAN_PAGE_COUNT}
          aria-label="الصفحة التالية" onClick={()=>go(page+1)}>التالي</button>
      </form>
      <div className={css.navigation} role="group" aria-label="الانتقال إلى سورة">
        <label htmlFor="quran-surah-select">انتقال لسورة</label>
        <select id="quran-surah-select" className={css.surahSelect} value={activeSurah}
          disabled={!surahs.length} onChange={e=>{
            const chosen=surahs.find(x=>x.number===Number(e.target.value));
            if(chosen)go(chosen.pageNumber);
          }}>
          {!surahs.length?<option value="">جار تحميل فهرس السور…</option>:
            surahs.map(x=><option key={x.number} value={x.number}>{x.number} — {x.nameArabic} (ص {x.pageNumber})</option>)}
        </select>
        {indexError&&<span role="status">يمكن الانتقال برقم الصفحة عند تعذر تحميل الفهرس.</span>}
      </div>
    </div>
    {error&&<div role="alert" className={css.warning}>{error}
      <button type="button" onClick={()=>setRefresh(x=>x+1)}>إعادة المحاولة</button></div>}
    <div className={css.grid}>
      <div className={css.pageShell}
        onTouchStart={e=>{startTouch.current={x:e.touches[0]?.clientX??0,y:e.touches[0]?.clientY??0};}}
        onTouchEnd={e=>{
          const start=startTouch.current,end=e.changedTouches[0];startTouch.current=null;
          if(!start||!end||inkMode!=='off'||mode!=='madinah')return;
          const dx=end.clientX-start.x,dy=end.clientY-start.y;
          if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.6)go(page+(dx>0?1:-1));
        }}>
        {mode==='madinah'?
          <SmoothMadinahPage page={page} overlay={
            <QuranInk page={page} mode={inkMode} color={color}
              strokes={inkByPage[page]??[]} onChange={changeInk}/>}/>:
          <div className={css.ayahDisplay} aria-label="عرض القرآن آية بآية">
            {loading?<p>جار تحميل آيات الصفحة…</p>:regions.length===0?<p>لا توجد بيانات آيات متاحة.</p>:
              regions.map(region=>{
                const key=refOf(region),text=texts[key];
                let wordIndex=0;
                return <div id={'quran-ayah-'+key.replace(':','-')} key={key}
                  className={css.ayahRow} style={{fontSize}}>
                  <button type="button" aria-pressed={selectedKey===key}
                    className={css.ayahRef} style={{background:marked[key]}}
                    onClick={()=>selectTarget({page,surah:region.surah,ayah:region.ayah,wordIndex:null})}>
                    ﴿{key}﴾{noteByKey.has(key)?' 📝':''}
                  </button>{' '}
                  {text?text.split(/(\s+)/u).map((part,i)=>{
                    if(!part.trim())return <span key={i}>{part}</span>;
                    wordIndex++;
                    const k=key+':w'+wordIndex,n=wordIndex;
                    return <button key={i} type="button" className={css.word} style={{background:marked[k]}}
                      aria-pressed={selectedKey===k}
                      onClick={()=>selectTarget({page,surah:region.surah,ayah:region.ayah,wordIndex:n})}>
                      {part}</button>;
                  }):<span>جار تحميل النص العثماني…</span>}
                </div>;
              })}
          </div>}
        <div className={css.pageCaption}>صفحة {pageName(page)} من 604 — التقليب يحتفظ بأبعاد الصفحة حتى اكتمال التحميل</div>
      </div>
      {showAside&&<aside className={css.sidebar} aria-label="آيات الصفحة والملاحظات">
        {showSearch&&<QuranSearchPanel onNavigate={(target,key)=>{
          go(target,key);setShowSearch(false);setMode('ayah');
        }}/>}
        {showNotes&&<section className={css.noteList} aria-label="جميع ملاحظاتي">
          <h3>جميع ملاحظاتي</h3>
          {visible.length===0?<p>لم تحفظ ملاحظات بعد في هذه المعاينة.</p>:
            visible.map(n=><button key={n.id} type="button" className={css.noteJump}
              onClick={()=>{go(n.target.page,n.target.surah+':'+n.target.ayah);setMode('ayah');}}>
              <strong>{n.type==='teacher'?'ملاحظة الشيخ':'ملاحظتي'} · {targetKey(n.target)} · ص {n.target.page}</strong>
              <span>{n.text}</span></button>)}
        </section>}
        <h3>آيات هذه الصفحة</h3>
        <label htmlFor="quran-page-search">بحث في الصفحة الحالية</label>
        <input id="quran-page-search" placeholder="نص الآية أو 2:255" value={localSearch}
          onChange={e=>setLocalSearch(e.target.value)}/>
        {loading&&<p role="status">تحميل مواضع الآيات…</p>}
        <div className={css.ayahLinks} aria-label="اختيار آية من الصفحة">
          {filtered.map(region=>{
            const key=refOf(region);
            return <button type="button" key={key} aria-pressed={selectedKey===key}
              className={selectedKey===key?css.active:css.button}
              style={{borderColor:marked[key]??undefined}}
              onClick={()=>selectTarget({page,surah:region.surah,ayah:region.ayah,wordIndex:null})}>
              {key}{noteByKey.has(key)?' ●':''}</button>;
          })}
        </div>
        {selectedTarget&&<div className={css.note}>
          <h3>آية {selectedTarget.surah}:{selectedTarget.ayah}
            {selectedTarget.wordIndex!==null?' · الكلمة '+selectedTarget.wordIndex:''}</h3>
          <div className={css.toolbar}>
            <button type="button" className={css.button} onClick={()=>setMarked(prev=>({
              ...prev,[targetKey(selectedTarget)]:color
            }))}>تظليل هذا الموضع</button>
            <button type="button" className={css.button} onClick={()=>setMarked(prev=>{
              const next={...prev};delete next[targetKey(selectedTarget)];return next;
            })}>إزالة التظليل</button>
          </div>
          <label htmlFor="quran-note">ملاحظة شخصية على الموضع المحدد (حتى 500 حرف)</label>
          <textarea id="quran-note" maxLength={500} rows={4} value={draft}
            onChange={e=>setDraft(e.target.value)}/>
          <button type="button" className={css.active} onClick={saveNote}>حفظ الملاحظة</button>
        </div>}
        {visible.filter(n=>n.target.page===page).length>0&&<div className={css.noteList}>
          <h3>ملاحظات الصفحة</h3>
          {visible.filter(n=>n.target.page===page).map(n=>
            <button key={n.id} type="button" className={css.noteJump}
              onClick={()=>{selectTarget(n.target);setShowNotes(false);}}>
              <strong>{targetKey(n.target)} · {n.type==='teacher'?'ملاحظة الشيخ':'ملاحظتي'}</strong>
              <span>{n.text}</span></button>)}
        </div>}
        <p className={css.info}>ستظهر ملاحظات الشيخ المعتمدة من سجل الفصل بعد ربط خدمة التقارير الآمنة. لا تعرض هذه المعاينة بيانات شيخ وهمية.</p>
      </aside>}
    </div>
    <div className={css.readerFoot}>
      <span>الملاحظات والتظليل والرسم الآن محلية مؤقتة لملف {selected.profile.name}، ولا تتم مزامنتها مع الشيخ أو الخادم بعد.</span>
      <button type="button" className={css.button} aria-label="تقليب إلى الصفحة السابقة"
        disabled={page===1} onClick={()=>go(page-1)}>السابق</button>
      <strong aria-live="polite">{page} / 604</strong>
      <button type="button" className={css.button} aria-label="تقليب إلى الصفحة التالية"
        disabled={page===604} onClick={()=>go(page+1)}>التالي</button>
      <button type="button" className={css.button} onClick={()=>{setShowAside(v=>!v);setHideChrome(false);}}>الآيات والملاحظات</button>
    </div>
  </div>;
}
