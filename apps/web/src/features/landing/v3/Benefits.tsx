/** Approved landing markup expressed as native, server-rendered React JSX. */
export function Benefits() {
  return (
    <section className="feature-bar" id="about" aria-label="مميزات الحلقات">
      <div className="container feature-row">
        <div className="feature"><svg className="feature-ico" width="38" height="38" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="8" y="5" width="24" height="30" rx="2"/><path d="M13 10h14M13 16h14M13 22h10M13 28h14"/></svg><div><h3>منهج واضح ومتدرّج</h3><p>حفظٌ جديد ومراجعةٌ تثبّت ما سبق</p></div></div>
        <div className="feature"><svg className="feature-ico" width="38" height="38" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="20" cy="11" r="6"/><path d="M7 33c1-8 6-12 13-12s12 4 13 12M6 34h28"/></svg><div><h3>تسميع مع الشيخ مباشرة</h3><p>تصحيح للتلاوة ومتابعة لكل طالب</p></div></div>
        <div className="feature"><svg className="feature-ico" width="38" height="38" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="6" y="9" width="28" height="26" rx="2"/><path d="M6 16h28M13 5v8M27 5v8M13 23h5M22 23h5M13 29h5"/></svg><div><h3>مواعيد تناسب يومك</h3><p>حصص أونلاين من الهاتف أو الحاسوب</p></div></div>
      </div>
    </section>
  );
}
