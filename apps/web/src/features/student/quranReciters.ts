/** Quran audio metadata from Mushaf-Learning/quran-audio (MIT).
 * Audio streams are hosted by EveryAyah, not licensed by the metadata's MIT license.
 * Direct remote streaming ONLY; do not mirror/copy audio without verified permission.
 */
import type { QuranAyahReference, QuranSurahInfo } from './quranSource';

export const QURAN_RECITERS = [
  { id: 'alafasy', name: 'مشاري راشد العفاسي', folder: 'Alafasy_128kbps', quality: '128 kbps', style: 'مرتل' },
  { id: 'muaiqly', name: 'ماهر المعيقلي', folder: 'MaherAlMuaiqly128kbps', quality: '128 kbps', style: 'مرتل' },
  { id: 'husary', name: 'محمود خليل الحصري', folder: 'Husary_128kbps', quality: '128 kbps', style: 'مرتل' },
  { id: 'minshawi', name: 'محمد صديق المنشاوي', folder: 'Minshawy_Murattal_128kbps', quality: '128 kbps', style: 'مرتل' },
  { id: 'sudais', name: 'عبدالرحمن السديس', folder: 'Abdurrahmaan_As-Sudais_192kbps', quality: '192 kbps', style: 'مرتل' },
  { id: 'abdulbasit', name: 'عبدالباسط عبدالصمد', folder: 'Abdul_Basit_Murattal_192kbps', quality: '192 kbps', style: 'مرتل' },
] as const;

export type QuranReciterId = typeof QURAN_RECITERS[number]['id'];
export type QuranAudioScope = 'ayah' | 'page' | 'surah';
export type QuranAudioRequest = Readonly<{
  token: number; scope: QuranAudioScope; page: number; ayah: QuranAyahReference | null;
}>;

const RECITER_FOLDERS: ReadonlyMap<string, string> = new Map(QURAN_RECITERS.map(r => [r.id, r.folder]));

export function reciterAudioUrl(reciter: QuranReciterId, surah: number, ayah: number): string {
  const folder = RECITER_FOLDERS.get(reciter);
  if (!folder || !Number.isInteger(surah) || surah < 1 || surah > 114 ||
    !Number.isInteger(ayah) || ayah < 1 || ayah > 286) {
    throw new RangeError('Invalid Quran audio reference or reciter');
  }
  return `https://everyayah.com/data/${folder}/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}
export function quranAudioKey(ref: QuranAyahReference): string { return ref.surah + ':' + ref.ayah; }

/** Page references originate from publisher SVG sidecars and must not be synthesized. */
export function createQuranAudioSequence(
  scope: QuranAudioScope,
  pageVerses: readonly QuranAyahReference[],
  surahs: readonly QuranSurahInfo[],
  chosen: QuranAyahReference | null,
): QuranAyahReference[] {
  if (scope === 'ayah') return chosen && validReference(chosen) ? [chosen] : [];
  if (scope === 'page') {
    const seen = new Set<string>();
    return pageVerses.filter(ref => {
      const key = quranAudioKey(ref);
      if (!validReference(ref) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const target = chosen?.surah ?? pageVerses[0]?.surah;
  if (!target) return [];
  const metadata = surahs.find(s => s.number === target);
  if (!metadata || !Number.isInteger(metadata.ayahCount) || metadata.ayahCount < 1 ||
    metadata.ayahCount > 286) return [];
  return Array.from({ length: metadata.ayahCount }, (_, i) => ({ surah: target, ayah: i + 1 }));
}
function validReference(ref: QuranAyahReference): boolean {
  return Number.isInteger(ref.surah) && ref.surah >= 1 && ref.surah <= 114 &&
    Number.isInteger(ref.ayah) && ref.ayah >= 1 && ref.ayah <= 286;
}
export function formatAudioClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const count = Math.floor(seconds);
  return Math.floor(count / 60) + ':' + String(count % 60).padStart(2, '0');
}
