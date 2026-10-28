'use client';

import { useState, type FormEvent } from 'react';
import { searchFullQuran, type QuranSearchResult } from '../quranSearch';
import css from './QuranSearchPanel.module.css';

export function QuranSearchPanel({ onNavigate }: {onNavigate:(page:number,key:string)=>void}) {
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [results,setResults]=useState<QuranSearchResult[]>([]);
  const [total,setTotal]=useState(0);

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(query.trim().length<2)return;
    setLoading(true);setError('');
    try {
      const data=await searchFullQuran(query);
      setResults(data.matches);setTotal(data.total);
    } catch (err) {
      setResults([]);setTotal(0);
      setError(err instanceof Error?err.message:'تعذر إكمال البحث في المصحف.');
    } finally {setLoading(false);}
  }
  return <section className={css.search} aria-labelledby="whole-quran-title">
    <h3 id="whole-quran-title">البحث في المصحف كاملًا</h3>
    <p>ابحث عن عبارة أو اكتب مرجعًا مثل 2:255. تُعرض النتائج من النص العثماني الموثّق.</p>
    <form onSubmit={(e)=>{void submit(e);}} className={css.form}>
      <label htmlFor="whole-quran-query">كلمة أو آية</label>
      <input id="whole-quran-query" value={query} onChange={e=>setQuery(e.target.value)}
        minLength={2} placeholder="ابحث في 6236 آية" />
      <button type="submit" disabled={loading||query.trim().length<2}>
        {loading?'تحميل فهرس البحث…':'بحث'}
      </button>
    </form>
    {loading&&<p role="status">يجري تجهيز النص الكامل وفهرس الصفحات لأول مرة؛ بعد ذلك يُعاد استخدامه دون تنزيل جديد في نفس الجلسة.</p>}
    {error&&<p role="alert" className={css.error}>{error}</p>}
    {!loading&&total>0&&<p role="status">{total} نتيجة — معروض أول {results.length} نتيجة</p>}
    {!loading&&!error&&total===0&&query.trim().length>=2&&<p>اضغط «بحث» لعرض النتائج.</p>}
    <div className={css.results}>
      {results.map(result=><button key={result.key} type="button"
        onClick={()=>onNavigate(result.page,result.key)}>
        <strong>{result.key} · صفحة {result.page}</strong>
        <span>{result.text}</span>
      </button>)}
    </div>
  </section>;
}
