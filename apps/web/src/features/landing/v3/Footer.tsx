/** Shared approved brand footer in native React JSX. */
export function Footer() {
  return <footer className="footer"><div className="container"><div className="footer-top"><div><a className="brand" href="#home"><span className="brand-logo" aria-hidden="true"><svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M51 7C44.6 13.5 39.9 22 41 30.9C42.1 39.5 47.6 44.4 55.1 46.1C52.4 49.4 47.4 51.1 42.2 50.2C30.7 48.2 24.4 39.7 26.2 29.4C27.9 19.5 37.2 10.5 51 7Z" fill="currentColor"/>
  <path d="M36 47.4C28.3 42.8 20.8 42.2 10.5 45.2V62.8C21 59.2 28.8 60.3 36 65.2V47.4Z" fill="#F8E7C2" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round"/>
  <path d="M36 47.4C43.7 42.8 51.2 42.2 61.5 45.2V62.8C51 59.2 43.2 60.3 36 65.2V47.4Z" fill="#FFF8E6" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round"/>
  <path d="M16 49.5C22 47.9 27 48.6 32 51.3M16 54C22 52.5 27 53.2 32 55.7M56 49.5C50 47.9 45 48.6 40 51.3M56 54C50 52.5 45 53.2 40 55.7" stroke="#B58C43" strokeWidth="1.3" strokeLinecap="round"/>
</svg></span><span><span className="brand-name">نور القرآن</span><span className="brand-caption">لِلحِفْظِ وَالْإِتْقَان</span></span></a><p className="footer-desc">حلقات القرآن الكريم عن بُعد، بعنايةٍ في التعليم ومتابعةٍ في الحفظ والمراجعة.</p></div><nav className="footer-links" aria-label="روابط التذييل"><a href="#about">عن المنهج</a><a href="#programs">البرامج</a><a href="#journey">كيف نبدأ؟</a><a href="#enroll">ابدأ رحلتك</a></nav></div><div className="footer-bottom"><span>© <span id="year">{new Date().getFullYear()}</span> نور القرآن. جميع الحقوق محفوظة.</span><span>تعليمٌ برفق، وحفظٌ بإتقان.</span></div></div></footer>;
}
