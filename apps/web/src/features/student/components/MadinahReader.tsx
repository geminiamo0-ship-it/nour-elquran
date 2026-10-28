'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStudent } from '../StudentContext';
import {
  clampQuranPage, parseQuranAyahRegions, parseQuranChapter, pageName,
  quranChapterUrl, quranPageMetadataUrl, quranPageUrl, quranReferenceKey,
  QURAN_PAGE_COUNT, type QuranAyahRegion, type QuranViewMode,
} from '../quranSource';
import css from './MadinahReader.module.css';

async function readJson(primary: string, fallback: string, signal: AbortSignal): Promise<unknown> {
  try {
    const res = await fetch(primary, { signal });
    if (!res.ok) throw new Error('Primary Quran source unavailable');
    return await res.json() as unknown;
  } catch (error) {
    if (signal.aborted) throw error;
    const res = await fetch(fallback, { signal });
    if (!res.ok) throw new Error('المصدر القرآني غير متاح حاليًا');
    return await res.json() as unknown;
  }
}

export function MadinahReader() {
  const { selected } = useStudent();
  const [page, setPage] = useState(1);
  const [pageEntry, setPageEntry] = useState('1');
  const [mode, setMode] = useState<QuranViewMode>('madinah');
  const [sourceFallback, setSourceFallback] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [regions, setRegions] = useState<QuranAyahRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [texts, setTexts] = useState<Record<string,string>>({});
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [fontSize, setFontSize] = useState(27);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setRegions([]); setSelectedKey(null); setSourceFallback(false); setImageFailed(false);
    void readJson(quranPageMetadataUrl(page), quranPageMetadataUrl(page,true), controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const normalized = parseQuranAyahRegions(data);
        if (!normalized.length) throw new Error('الصفحة لا تحتوي على خريطة آيات موثقة.');
        setRegions(normalized);
      }).catch((e:unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'تعذّر تحميل مواضع الآيات.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[page,refresh]);

  useEffect(() => {
    if (mode !== 'ayah' || !regions.length) return;
    const controller = new AbortController();
    const surahs = [...new Set(regions.map(x=>x.surah))];
    void Promise.all(surahs.map(async (surah) => {
      const data = await readJson(quranChapterUrl(surah),quranChapterUrl(surah,true),controller.signal);
      const result = parseQuranChapter(data,surah);
      return [...result].map(([ayah,text]) => [`${surah}:${ayah}`,text] as const);
    })).then((groups) => {
      if (!controller.signal.aborted) setTexts((old) => Object.assign({},old,...groups.map(Object.fromEntries)));
    }).catch(() => {
      if (!controller.signal.aborted) setError('تعذّر تحميل النص المصاحب لهذه الصفحة. يمكن متابعة عرض المصحف الأصلي.');
    });
    return () => controller.abort();
  },[mode,regions]);

  const filtered = useMemo(() => {
    const query = search.trim();
    if (!query) return regions;
    return regions.filter((region) => {
      const key = quranReferenceKey(region);
      return key.includes(query) || (texts[key] ?? '').includes(query);
    });
  },[regions,search,texts]);

  function go(next:number) {
    const target=clampQuranPage(next);
    setPage(target); setPageEntry(String(target)); setSearch('');
  }
  function selectAyah(key:string) {
    setSelectedKey(key);setDraft(notes[key] ?? '');
  }
  function saveNote() {
    if (!selectedKey) return;
    setNotes((old)=>({...old,[selectedKey]:draft.trim().slice(0,250)}));
  }

  return <div className={css.reader}>
    <div className={css.intro}>
      <strong>مصحف المدينة النبوية — حفص عن عاصم</strong>
      <p>صفحات رسمية مطابقة للأصل بصيغة SVG، مع خريطة مواضع الآيات من المصدر الموثق. لا نولّد أي كلمة من القرآن بالذكاء الاصطناعي.</p>
    </div>
    <div className={css.toolbar} role="group" aria-label="أوضاع المصحف">
      <button type="button" className={mode==='madinah'?css.active:css.button}
        aria-pressed={mode==='madinah'} onClick={()=>setMode('madinah')}>مصحف المدينة</button>
      <button type="button" className={mode==='ayah'?css.active:css.button}
        aria-pressed={mode==='ayah'} onClick={()=>setMode('ayah')}>آية بآية</button>
      <label htmlFor="quran-font-size">حجم النص</label>
      <input id="quran-font-size" type="range" min="22" max="42" step="2"
        value={fontSize} onChange={(event)=>setFontSize(Number(event.target.value))}
        disabled={mode==='madinah'}/>
    </div>
    <form className={css.navigation} onSubmit={(event)=>{
      event.preventDefault();const n=Number(pageEntry);
      if (Number.isInteger(n) && n>=1 && n<=QURAN_PAGE_COUNT) go(n);
    }}>
      <button type="button" className={css.button} disabled={page===1}
        onClick={()=>go(page-1)} aria-label="الصفحة السابقة">السابق</button>
      <label htmlFor="quran-page-input">الصفحة</label>
      <input id="quran-page-input" type="number" min="1" max="604" step="1"
        value={pageEntry} onChange={(event)=>setPageEntry(event.target.value)} dir="ltr"/>
      <span>من {QURAN_PAGE_COUNT}</span>
      <button type="submit" className={css.button}>انتقال</button>
      <button type="button" className={css.button} disabled={page===QURAN_PAGE_COUNT}
        onClick={()=>go(page+1)} aria-label="الصفحة التالية">التالي</button>
    </form>
    {error && <div className={css.warning} role="alert">{error}
      <button type="button" onClick={()=>setRefresh((n)=>n+1)}>إعادة المحاولة</button>
    </div>}
    <div className={css.grid}>
      <div className={css.pageShell}>
        {mode==='madinah' ? <>
          {!imageFailed ? <img key={page+'-'+sourceFallback} className={css.pageImage}
            alt={`صفحة ${page} من مصحف المدينة النبوية برواية حفص`}
            src={quranPageUrl(page,sourceFallback)}
            onError={()=>{if(!sourceFallback)setSourceFallback(true);else setImageFailed(true);}} /> :
            <div className={css.warning} role="alert">تعذر تحميل صورة الصفحة من المصدرين. تحقق من الاتصال ثم أعد المحاولة.</div>}
        </> : <div className={css.ayahDisplay} aria-label="عرض القرآن آية بآية">
          {loading ? <p>جار تحميل آيات الصفحة…</p> : regions.length ? regions.map((region)=>{
            const key=quranReferenceKey(region);
            return <button key={key} type="button" className={selectedKey===key?css.ayahSelected:css.ayah}
              aria-pressed={selectedKey===key} onClick={()=>selectAyah(key)}
              style={{fontSize}}>
              {texts[key] ? <span>{texts[key]}</span> : <span>جاري تحميل نص الآية…</span>}
              <small>﴿{region.surah}:{region.ayah}﴾</small>
            </button>;
          }) : <p>لا توجد بيانات آيات متاحة.</p>}
        </div>}
        <div className={css.pageCaption}>صفحة {pageName(page)} من 604 · {sourceFallback?'العرض المباشر من المصدر الرسمي الموثّق':'خادم أصول نور القرآن'}</div>
      </div>
      <aside className={css.sidebar} aria-label="آيات الصفحة والملاحظات">
        <h3>آيات هذه الصفحة</h3>
        <label htmlFor="quran-page-search">بحث في الصفحة الحالية</label>
        <input id="quran-page-search" value={search} onChange={(e)=>setSearch(e.target.value)}
          placeholder="نص الآية أو 2:255" />
        {loading && <p role="status">جار تحميل خريطة الآيات…</p>}
        <div className={css.ayahLinks} aria-label="اختيار آية من الصفحة">
          {filtered.map((ref)=>{
            const key=quranReferenceKey(ref);
            return <button type="button" key={key} aria-pressed={selectedKey===key}
              className={selectedKey===key?css.active:css.button}
              onClick={()=>selectAyah(key)}>{key}</button>;
          })}
        </div>
        {!loading && !filtered.length && <p>لا توجد آيات مطابقة في هذه الصفحة.</p>}
        {selectedKey && <div className={css.note}>
          <h3>ملاحظتي الخاصة على آية {selectedKey}</h3>
          <label htmlFor="quran-note">ملاحظة محلية، لا تُرسل للشيخ</label>
          <textarea id="quran-note" maxLength={250} rows={3}
            value={draft} onChange={(e)=>setDraft(e.target.value)} />
          <button type="button" className={css.active} onClick={saveNote}>حفظ الملاحظة</button>
        </div>}
        {Object.entries(notes).some(([,t])=>t) && <div className={css.noteList}>
          <h3>ملاحظات الصفحة</h3>
          {Object.entries(notes).filter(([,t])=>t).map(([key,text])=>
            <p key={key}><strong>{key}:</strong> {text}</p>)}
          <button type="button" className={css.button} onClick={()=>{setNotes({});setDraft('');setSelectedKey(null);}}>
            مسح العلامات
          </button>
        </div>}
      </aside>
    </div>
    <p className={css.disclaimer}>النص العثماني يُعرض دون تعديل. الملاحظات في هذه المرحلة محلية مؤقتة للطالب {selected.profile.name}، ولا تُرفع للسحابة ولا تُمثل تصحيحًا أكاديميًا. التلاوات والتحديد بالكلمات تأتي في المراحل التالية.</p>
  </div>;
}
