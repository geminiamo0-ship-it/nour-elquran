import { describe, expect, it } from 'vitest';
import {
  QURAN_PAGE_COUNT, QURAN_CHAPTER_COUNT, clampQuranPage, pageName, quranPageUrl,
  quranPageMetadataUrl, quranChapterUrl, parseQuranAyahRegions,
  parseQuranChapter, quranReferenceKey,
} from './quranSource';

describe('verified Quran source adapter (no generated ayah text)', () => {
  it('enforces 604 authoritative page bounds and static Quran URLs', () => {
    expect(QURAN_PAGE_COUNT).toBe(604);
    expect(QURAN_CHAPTER_COUNT).toBe(114);
    expect(clampQuranPage(0)).toBe(1);
    expect(clampQuranPage(605)).toBe(604);
    expect(clampQuranPage(NaN)).toBe(1);
    expect(pageName(1)).toBe('001');
    expect(pageName(604)).toBe('604');
    expect(quranPageUrl(1)).toContain('/quran/hafs/v1.1.1/pages/001.svg');
    expect(quranPageMetadataUrl(604)).toContain('/quran/hafs/v1.1.1/pages/604.json');
    expect(quranPageUrl(2,true)).toContain('raw.githubusercontent.com/quran-ws/quran-svg/9fc0c87/mushafs/hafs/kfqc/svg/002.svg');
    expect(quranChapterUrl(114)).toContain('/text/chapters/114.json');
    expect(() => quranChapterUrl(115)).toThrow(RangeError);
  });
  it('only exposes valid unique publisher ayah polygon records', () => {
    const data = { page: 42, ayahs: [
      { surahNumber: 2, ayahNumber: 255, polygon: 'M 0 0 L 5 5 Z' },
      { surahNumber: 2, ayahNumber: 255, polygon: 'M 0 0 L 5 5 Z' },
      { surahNumber: 2, ayahNumber: 256, polygon: '1,2 3,4' },
      { surahNumber: 500, ayahNumber: 2, polygon: 'invalid' },
      { surahNumber: 2, ayahNumber: 257, polygon: null },
    ] };
    const refs = parseQuranAyahRegions(data);
    expect(refs.map(quranReferenceKey)).toEqual(['2:255','2:256']);
    expect(parseQuranAyahRegions({ irrelevant: 'text' })).toEqual([]);
  });
  it('maps Uthmani verse text by canonical surah:ayah and never invents missing verses', () => {
    const verses = parseQuranChapter({ id: 2, verses: [
      { id:'2:1', text:'الم' }, { id:'2:2',text:'ذَٰلِكَ ٱلْكِتَٰبُ' },
      { id:'2:3',text:'' },
    ] }, 2);
    expect(verses.get(1)).toBe('الم');
    expect(verses.get(2)).toBe('ذَٰلِكَ ٱلْكِتَٰبُ');
    expect(verses.has(3)).toBe(false);
    expect(parseQuranChapter([], 1).size).toBe(0);
  });
  it('parses the actual Quran JSON numeric ids without shifting or fabricating verses', () => {
    const data = { id: 1, verses: [
      { id: 1, text: 'بِسْمِ ٱللَّهِ' },
      { id: 3, text: 'مَٰلِكِ' },
      { id: 3, text: 'duplicate must not overwrite' },
      { text: 'no identifier' },
      { id: '2:5', text: 'wrong surah' },
      { id: '1:6', text: 'valid explicit reference' },
      { id: 0, text: 'invalid zero' },
      { id: 'not-an-ayah', text: 'invalid identifier' },
    ] };
    const verses = parseQuranChapter(data, 1);
    expect([...verses.entries()]).toEqual([[1, 'بِسْمِ ٱللَّهِ'], [3, 'مَٰلِكِ'], [6, 'valid explicit reference']]);
    expect(verses.has(2)).toBe(false);
    expect(verses.has(4)).toBe(false);
    expect(parseQuranChapter(data, 2).size).toBe(0);
    expect(parseQuranChapter({ verses: data.verses }, 1).size).toBe(0);
    expect(parseQuranChapter({ id: 1, verses: [{ id: 2, text: 'preserved' }] }, 1).get(2)).toBe('preserved');
  });
});
