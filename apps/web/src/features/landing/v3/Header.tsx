'use client';
import { useEffect, useState } from 'react';

export function Header() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, []);
  return (<header className="site-header">

    <div className="container header-inner">
      <a className="brand" href="#home" aria-label="نور القرآن — الرئيسية">
        <span className="brand-logo" aria-hidden="true">
          <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M51 7C44.6 13.5 39.9 22 41 30.9C42.1 39.5 47.6 44.4 55.1 46.1C52.4 49.4 47.4 51.1 42.2 50.2C30.7 48.2 24.4 39.7 26.2 29.4C27.9 19.5 37.2 10.5 51 7Z" fill="currentColor" />
  <path d="M36 47.4C28.3 42.8 20.8 42.2 10.5 45.2V62.8C21 59.2 28.8 60.3 36 65.2V47.4Z" fill="#F8E7C2" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
  <path d="M36 47.4C43.7 42.8 51.2 42.2 61.5 45.2V62.8C51 59.2 43.2 60.3 36 65.2V47.4Z" fill="#FFF8E6" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
  <path d="M16 49.5C22 47.9 27 48.6 32 51.3M16 54C22 52.5 27 53.2 32 55.7M56 49.5C50 47.9 45 48.6 40 51.3M56 54C50 52.5 45 53.2 40 55.7" stroke="#B58C43" strokeWidth="1.3" strokeLinecap="round" />
</svg>
        </span>
        <span><span className="brand-name">نور القرآن</span><span className="brand-caption">لِلحِفْظِ وَالْإِتْقَان</span></span>
      </a>
      <nav className={open ? "nav open" : "nav"} id="siteNav" onClick={(event) => { if (event.target instanceof Element && event.target.closest("a")) setOpen(false); }} aria-label="القائمة الرئيسية">
        <a href="#about">عن المنهج</a>
        <a href="#programs">البرامج</a>
        <a href="#interactive-classroom">الفصل التفاعلي</a>
        <a href="#journey">كيف نبدأ؟</a>
        <a href="#questions">الأسئلة الشائعة</a>
        <a className="primary-mobile" href="#enroll">إنشاء حساب تجريبي</a>
      </nav>
      <a className="btn btn-gold header-cta" href="#enroll">احجز حصة تجريبية <span aria-hidden="true">↖</span></a>
      <button className="mobile-menu-btn" id="menuBtn" type="button" aria-controls="siteNav" aria-expanded={open} aria-label={open ? "إغلاق القائمة" : "فتح القائمة"} onClick={() => setOpen((value) => !value)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h18" /></svg>
      </button>
    </div>
  
  </header>);
}
