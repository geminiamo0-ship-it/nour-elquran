/** Approved landing markup expressed as native, server-rendered React JSX. */
export function Programs() {
  return (
    <section className="section" id="programs">
      <div className="container">
        <div className="section-heading center"><span className="eyebrow">بَرَامِجُنَا التَّعْلِيمِيَّة</span><h2>لكلِّ مرحلةٍ طريقٌ إلى الإتقان</h2><p>نختار لك البرنامج الذي يوافق مستواك، مع العناية بحسن التلاوة وثبات المحفوظ.</p></div>
        <div className="program-grid">
          <article className="program-card"><span className="num">٠١</span><div className="program-icon"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 8c5-2 8-1 11 1 3-2 6-3 11-1v18c-5-2-8-1-11 1-3-2-6-3-11-1V8ZM16 9v18"/><path d="M9 12h4M19 12h4"/></svg></div><h3>تصحيح التلاوة</h3><p>للمبتدئين ومن يرغب في تحسين القراءة، مع العناية بمخارج الحروف وأحكام التجويد.</p></article>
          <article className="program-card"><span className="num">٠٢</span><div className="program-icon"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 4h18v25l-9-7-9 7V4Z"/><path d="M11 10h10M11 14h10"/></svg></div><h3>حفظ القرآن الكريم</h3><p>ورد حفظ مناسب لقدرة الطالب، وتسميع مباشر مع الشيخ، وخطة مراجعة مصاحبة.</p></article>
          <article className="program-card"><span className="num">٠٣</span><div className="program-icon"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M26 15a10 10 0 1 1-4-8M26 5v8h-8"/><path d="M16 9v7l5 3"/></svg></div><h3>المراجعة والتثبيت</h3><p>لمن أتمّ حفظ سور أو أجزاء، ويريد استدراك مواضع الضعف وتثبيت المحفوظ.</p></article>
        </div>
      </div>
    </section>
  );
}
