export const QURAN_EDITION = 'hafs-kfqc' as const;
export const QURAN_VERSION = 'v1.1.1' as const;
export const QURAN_PAGE_COUNT = 604;
export const QURAN_CHAPTER_COUNT = 114;

export type QuranAyahReference = Readonly<{ surah: number; ayah: number }>;
export type QuranAyahRegion = QuranAyahReference & Readonly<{ polygon: string }>;
export type QuranViewMode = 'madinah' | 'ayah';

const WORKER_DEFAULT = 'https://noor-quran-assets.geminiamo0.workers.dev';
const PREFERRED_ORIGIN = process.env.NEXT_PUBLIC_NOOR_QURAN_ASSETS_ORIGIN || WORKER_DEFAULT;
export const QURAN_ASSETS_ORIGIN = /^https:\/\/[a-z\d.-]+(?::443)?$/i.test(PREFERRED_ORIGIN)
  ? PREFERRED_ORIGIN.replace(/\/$/, '') : WORKER_DEFAULT;
const EDITION_ROOT = `${QURAN_ASSETS_ORIGIN}/quran/hafs/${QURAN_VERSION}`;
const PUBLIC_FALLBACK = 'https://raw.githubusercontent.com/quran-ws/quran-svg/9fc0c87/mushafs/hafs/kfqc';

export function clampQuranPage(value: number): number {
  return Number.isFinite(value) ? Math.min(QURAN_PAGE_COUNT, Math.max(1, Math.floor(value))) : 1;
}
export function isQuranReference(value: unknown): value is QuranAyahReference {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return Number.isInteger(r.surah) && Number(r.surah) >= 1 && Number(r.surah) <= QURAN_CHAPTER_COUNT
    && Number.isInteger(r.ayah) && Number(r.ayah) >= 1;
}
export function pageName(page: number): string {
  return String(clampQuranPage(page)).padStart(3, '0');
}
export function quranPageUrl(page: number, fallback = false): string {
  const p = pageName(page);
  return fallback ? `${PUBLIC_FALLBACK}/svg/${p}.svg` : `${EDITION_ROOT}/pages/${p}.svg`;
}
export function quranPageMetadataUrl(page: number, fallback = false): string {
  const p = pageName(page);
  return fallback ? `${PUBLIC_FALLBACK}/json/${p}.json` : `${EDITION_ROOT}/pages/${p}.json`;
}
export function quranChapterUrl(chapter: number, fallback = false): string {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > QURAN_CHAPTER_COUNT)
    throw new RangeError('Chapter out of range');
  return fallback
    ? `https://quran-json.risanb.com/text/uthmani/chapters/${chapter}.json`
    : `${EDITION_ROOT}/text/chapters/${String(chapter).padStart(3, '0')}.json`;
}

/** Parse the Quran SVG public per-page JSON without guessing any ayah or copying Quran text. */
export function parseQuranAyahRegions(data: unknown): QuranAyahRegion[] {
  const result = new Map<string, QuranAyahRegion>();
  function walk(value: unknown): void {
    if (Array.isArray(value)) { for (const x of value) walk(x); return; }
    if (value === null || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    const ref = { surah: Number(v.surahNumber), ayah: Number(v.ayahNumber) };
    if (isQuranReference(ref) && typeof v.polygon === 'string' && v.polygon.length > 2) {
      const key = `${ref.surah}:${ref.ayah}`;
      if (!result.has(key)) result.set(key, { ...ref, polygon: v.polygon });
      return;
    }
    for (const x of Object.values(v)) walk(x);
  }
  walk(data);
  return [...result.values()];
}
export function parseQuranChapter(data: unknown, surah: number): Map<number, string> {
  const result = new Map<number, string>();
  if (!data || typeof data !== 'object') return result;
  const verses = (data as { verses?: unknown }).verses;
  if (!Array.isArray(verses)) return result;
  verses.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const item = raw as Record<string, unknown>;
    if (typeof item.text !== 'string' || !item.text.trim()) return;
    const id = typeof item.id === 'string' ? item.id : '';
    const parts = id.split(':').map(Number);
    const n = parts.length === 2 && parts[0] === surah && Number.isInteger(parts[1])
      ? Number(parts[1]) : index + 1;
    if (n > 0) result.set(n, item.text);
  });
  return result;
}
/** Respects surah:ayah uniqueness and keeps page order from the publisher sidecar. */
export function quranReferenceKey(ref: QuranAyahReference): string {
  return `${ref.surah}:${ref.ayah}`;
}
