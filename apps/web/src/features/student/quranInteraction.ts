/** Short second-tap window that works with pointer/touch and mouse synthetic click events. */
export const QURAN_DOUBLE_TAP_MS = 450;
export type QuranTap = Readonly<{key:string;at:number}>;
export function isQuranDoubleTap(previous:QuranTap|null,key:string,now:number):boolean {
  return previous!==null&&previous.key===key&&Number.isFinite(now)&&now>=previous.at&&
    now-previous.at<=QURAN_DOUBLE_TAP_MS;
}
