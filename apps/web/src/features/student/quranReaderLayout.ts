export type ReaderPageMode = 'auto' | 'single' | 'double';

/** The opening page is alone; the remaining printed leaves share (2,3), (4,5), ... */
export function getVisibleSpread(page: number, mode: ReaderPageMode, mobile: boolean): number[] {
  const n = Number.isFinite(page) ? Math.max(1, Math.min(604, Math.floor(page))) : 1;
  if (mobile || mode === 'single' || n === 1) return [n];
  const first = n % 2 === 0 ? n : n - 1;
  return first + 1 <= 604 ? [first, first + 1] : [first];
}

export type ReaderTurnDirection = -1 | 1;

/** A turn moves one *visible leaf* on mobile/ayah mode, or one physical spread on desktop.
 * Direct page/surah/ayah jumps remain exact, even when their page is the second leaf.
 */
export function getAdjacentReaderPage(
  page: number, mode: ReaderPageMode, mobile: boolean,
  direction: ReaderTurnDirection, ayahMode = false,
): number {
  const current = Number.isFinite(page) ? Math.max(1, Math.min(604, Math.floor(page))) : 1;
  if (mobile || mode === 'single' || ayahMode) {
    return Math.max(1, Math.min(604, current + direction));
  }
  const spread = getVisibleSpread(current, mode, false);
  if (direction === 1) return Math.min(604, spread[spread.length - 1]! + 1);
  const first = spread[0]!;
  return first <= 2 ? 1 : first - 2;
}
