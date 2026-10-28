/** Exact approved HTML fragment; isolated as a React section for progressive migration. */
export function Verse() {
  return <section {...{"className":"verse-section","aria-labelledby":"verse-heading"}} dangerouslySetInnerHTML={{ __html: "\n      <div class=\"container verse-inner\"><div class=\"verse-mark\" aria-hidden=\"true\">۞</div><h2 id=\"verse-heading\" class=\"verse-text\">﴿ وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ ﴾</h2><p class=\"verse-ref\">سورة القمر · الآية ١٧</p></div>\n    " }} />;
}
