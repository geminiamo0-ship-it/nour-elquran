import type { QuranAyahReference } from './quranSource';
/** Only explicit, publisher-grounded Quran references; never derive a verse range from a translated display string. */
export type QuranAssignmentRange = Readonly<{
  surah: number;
  fromAyah: number;
  toAyah: number;
  page: number;
}>;

export const VOLUNTARY_SAMPLES: ReadonlyArray<Readonly<{
  name: string;
  range: QuranAssignmentRange;
}>> = [
  { name: 'الإخلاص', range: { surah: 112, fromAyah: 1, toAyah: 4, page: 604 } },
  { name: 'الفلق', range: { surah: 113, fromAyah: 1, toAyah: 5, page: 604 } },
  { name: 'الناس', range: { surah: 114, fromAyah: 1, toAyah: 6, page: 604 } },
];
export function validAssignmentRange(value: QuranAssignmentRange | undefined): value is QuranAssignmentRange {
  return !!value && Number.isInteger(value.surah) && value.surah >= 1 && value.surah <= 114 &&
    Number.isInteger(value.fromAyah) && value.fromAyah >= 1 &&
    Number.isInteger(value.toAyah) && value.toAyah >= value.fromAyah && value.toAyah <= 286 &&
    Number.isInteger(value.page) && value.page >= 1 && value.page <= 604;
}
export function referencesForRange(range: QuranAssignmentRange): QuranAyahReference[] {
  if (!validAssignmentRange(range)) return [];
  return Array.from({ length: range.toAyah - range.fromAyah + 1 },
    (_, i) => ({ surah: range.surah, ayah: range.fromAyah + i }));
}
export function rangeContains(range: QuranAssignmentRange, ref: QuranAyahReference): boolean {
  return validAssignmentRange(range) && ref.surah === range.surah &&
    ref.ayah >= range.fromAyah && ref.ayah <= range.toAyah;
}
export function nextBookedLesson<T extends {dayOffset:number;status:string}>(lessons:readonly T[]):T|null {
  return [...lessons].filter(x=>x.status==='booked' && x.dayOffset>=0)
    .sort((a,b)=>a.dayOffset-b.dayOffset)[0] ?? null;
}
