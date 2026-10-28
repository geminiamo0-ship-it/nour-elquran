export type QuranTarget = Readonly<{
  page: number;
  surah: number;
  ayah: number;
  wordIndex: number | null;
}>;
export type QuranAnnotation = Readonly<{
  id: string;
  learnerId: string;
  type: 'private' | 'teacher';
  published: boolean;
  authorLabel: string;
  target: QuranTarget;
  text: string;
  color: string;
  createdAt: string;
  lessonId?: string;
}>;
export type QuranInkStroke = Readonly<{
  id: string; page: number; color: string; width: number; kind: 'pen'|'marker';
  points: readonly {x:number;y:number}[];
}>;

export function validTarget(target: QuranTarget): boolean {
  return Number.isInteger(target.page) && target.page>=1 && target.page<=604 &&
    Number.isInteger(target.surah) && target.surah>=1 && target.surah<=114 &&
    Number.isInteger(target.ayah) && target.ayah>=1 &&
    (target.wordIndex===null || (Number.isInteger(target.wordIndex) && target.wordIndex>=1));
}
export function targetKey(target: QuranTarget): string {
  return target.surah + ':' + target.ayah + (target.wordIndex===null ? '' : ':w' + target.wordIndex);
}
export function noteMatchesTarget(note: QuranAnnotation, key: string): boolean {
  const whole=note.target.surah+':'+note.target.ayah;
  return key === whole || key.startsWith(whole+':w');
}
/** Teacher notes must be published, explicitly addressed to this learner, and sourced from the approved lesson API. */
export function visibleAnnotations(notes: readonly QuranAnnotation[], learnerId: string): QuranAnnotation[] {
  return notes.filter(x=>x.learnerId===learnerId && validTarget(x.target) &&
    (x.type==='private' || (x.type==='teacher' && x.published && !!x.lessonId)))
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export function notePreview(text: string): string {
  return text.trim().slice(0,500);
}
export function pointToPath(points: readonly {x:number;y:number}[]): string {
  return points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
}
