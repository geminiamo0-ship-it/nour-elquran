import { describe, expect, it } from 'vitest';
import {
  QURAN_RECITERS, reciterAudioUrl, createQuranAudioSequence,
  quranAudioKey, formatAudioClock
} from './quranReciters';
import type { QuranSurahInfo } from './quranSource';
const surahs: QuranSurahInfo[] = [
  { number: 1, nameArabic: 'الفاتحة', pageNumber: 1, ayahCount: 7, juzNumber: 1 },
  { number: 2, nameArabic: 'البقرة', pageNumber: 2, ayahCount: 286, juzNumber: 1 },
];
describe('Hafs reciter-only public stream adapter', () => {
  it('offers only explicitly listed Hafs reciters and correct verse URLs', () => {
    expect(QURAN_RECITERS).toHaveLength(6);
    expect(new Set(QURAN_RECITERS.map(r => r.id)).size).toBe(6);
    expect(reciterAudioUrl('alafasy', 1, 1)).toBe('https://everyayah.com/data/Alafasy_128kbps/001001.mp3');
    expect(reciterAudioUrl('muaiqly', 2, 255)).toBe('https://everyayah.com/data/MaherAlMuaiqly128kbps/002255.mp3');
    expect(() => reciterAudioUrl('alafasy', 115, 1)).toThrow(RangeError);
    expect(() => reciterAudioUrl('alafasy', 1, 0)).toThrow(RangeError);
  });
  it('does not invent ayah count for a missing surah source', () => {
    expect(createQuranAudioSequence('surah', [], surahs, {surah:3,ayah:1})).toEqual([]);
    expect(createQuranAudioSequence('surah', [], surahs, {surah:1,ayah:5})).toHaveLength(7);
    expect(createQuranAudioSequence('surah', [], surahs, {surah:2,ayah:255})[285])
      .toEqual({surah:2,ayah:286});
  });
  it('page mode deduplicates publisher references and never fills a missing verse', () => {
    const v = [{surah:2,ayah:1},{surah:2,ayah:2},{surah:2,ayah:2},{surah:2,ayah:5}];
    expect(createQuranAudioSequence('page', v, surahs, null)).toEqual([
      {surah:2,ayah:1},{surah:2,ayah:2},{surah:2,ayah:5}
    ]);
    expect(createQuranAudioSequence('ayah', v, surahs, {surah:2,ayah:5})).toEqual([{surah:2,ayah:5}]);
    expect(createQuranAudioSequence('ayah', v, surahs, null)).toEqual([]);
    expect(quranAudioKey({surah:2,ayah:255})).toBe('2:255');
  });
  it('formats stable playback clocks', () => {
    expect(formatAudioClock(3)).toBe('0:03');
    expect(formatAudioClock(125.9)).toBe('2:05');
    expect(formatAudioClock(NaN)).toBe('0:00');
  });
});
