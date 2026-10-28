export function Hero() {
  return (
    <section className="hero" id="home">

      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">حَلَقَاتُ القُرْآنِ الكَرِيمِ عَنْ بُعْد</span>
          <h1>مع القرآنِ،<br />يُزهرُ <span className="gold-word">القلبُ</span><br />ويستقيمُ اللسان.</h1>
          <p className="hero-desc">رحلة حفظٍ وتلاوة بصحبة معلّم يتابعك خطوة بخطوة. مصحف تفاعلي، وحصص مباشرة، وتدريبات تظل معك بعد انتهاء كل لقاء — للصغار والكبار.</p>
          <div className="hero-actions">
            <a href="#enroll" className="btn btn-gold">احجز حصة تجريبية <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m14 5-7 7 7 7" /></svg></a>
            <a href="#programs" className="btn btn-outline">تعرّف على البرامج</a>
          </div>
          <div className="hero-meta"><span className="hero-meta-item"><span className="checkmark">✓</span> حصص مباشرة مع معلّم</span><span className="sep"></span><span className="hero-meta-item"><span className="checkmark">✓</span> لوحة طالب كاملة من أول يوم</span></div>
        </div>
        <div className="hero-art" role="img" aria-label="زخرفة هندسية مستوحاة من الطراز الإسلامي مع مصحف مفتوح داخل محراب بلون أخضر عميق وذهبي">
          <svg className="star-side" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M33.5 4.5C23 13 22.4 25.7 29.8 33.2c4.4 4.3 9.6 5.6 14.2 5.1C37 44.6 27.7 44.9 20.9 39 10.5 30.1 13.1 15.2 23.4 8.3c3.1-2.1 6.5-3.3 10.1-3.8Z" fill="#C8A059" /></svg>
          <div className="art-frame">
            <div className="art-inner">
              <svg className="art-motif" viewBox="0 0 240 130" fill="none" aria-hidden="true"><path d="M42 117V90C42 47 74 16 120 7c46 9 78 40 78 83v27" stroke="#dfc487" strokeWidth="1.2" opacity=".75" /><path d="M61 117V92c0-31 21-53 59-64 38 11 59 33 59 64v25" stroke="#dfc487" strokeWidth="1" opacity=".5" /><path d="M87 113c13-7 23-10 33-10s20 3 33 10M98 88h44M120 36v42" stroke="#dfc487" strokeWidth="1" opacity=".5" /><circle cx="120" cy="86" r="5" fill="#dfc487" opacity=".7" /></svg>
              <div className="art-halo" aria-hidden="true"></div>
              <div className="art-saying">نورٌ على نور</div>
              <div className="art-sub">مَعَ القُرْآنِ خُطْوَةً بِخُطْوَة</div>
              <svg className="book-illustration" viewBox="0 0 270 145" fill="none" aria-hidden="true">
                <ellipse cx="135" cy="131" rx="123" ry="10" fill="#13251b" opacity=".6" />
                <path d="M25 43c36-14 75-12 109 4v75c-35-18-70-20-109-8V43Z" fill="#f5e6bd" stroke="#bb9853" strokeWidth="3" />
                <path d="M245 43c-36-14-75-12-109 4v75c35-18 70-20 109-8V43Z" fill="#f8edce" stroke="#bb9853" strokeWidth="3" />
                <path d="M19 50c41-13 81-12 115 6M251 50c-41-13-81-12-115 6" stroke="#f6cc6c" strokeWidth="7" />
                <path d="M31 52c37-10 72-7 103 8M239 52c-37-10-72-7-103 8" stroke="#c0a46e" strokeWidth="1.3" />
                <path d="M135 48v76" stroke="#9b783d" strokeWidth="3" />
                <path d="M43 72c26-6 53-4 73 4M43 84c26-6 53-4 73 4M43 96c26-6 53-4 73 4M226 72c-26-6-53-4-73 4M226 84c-26-6-53-4-73 4M226 96c-26-6-53-4-73 4" stroke="#9a885d" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
                <path d="M19 114 135 131 251 114" stroke="#ddbd74" strokeWidth="7" strokeLinejoin="round" /><path d="m134 128-33 8-21 3M136 128l33 8 21 3" stroke="#bc8e42" strokeWidth="6" strokeLinecap="round" /><path d="m135 124-26 16m26-16 26 16" stroke="#e1b25b" strokeWidth="6" strokeLinecap="round" />
              </svg>
              <div className="art-plinth"></div>
            </div>
          </div>
          <div className="art-corner"><div className="art-corner-icon"><svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z" /><path d="m8 12 3 3 5-6" /></svg></div><div><p>صحبةٌ تُعين على الإتقان</p><span>تعليم مباشر ومتابعة مستمرة</span></div></div>
        </div>
      </div>
    
    </section>
  );
}
