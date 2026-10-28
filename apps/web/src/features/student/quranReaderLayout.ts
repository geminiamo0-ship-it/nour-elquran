export type ReaderPageMode = 'auto' | 'single' | 'double';

/** The opening page is alone; the remaining printed leaves share (2,3), (4,5), ... */
export function getVisibleSpread(page: number, mode: ReaderPageMode, mobile: boolean): number[] {
  const n = Number.isFinite(page) ? Math.max(1, Math.min(604, Math.floor(page))) : 1;
  if (mobile || mode === 'single' || n === 1) return [n];
  const first = n % 2 === 0 ? n : n - 1;
  return first + 1 <= 604 ? [first, first + 1] : [first];
}
