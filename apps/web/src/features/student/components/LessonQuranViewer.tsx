'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  pageKeysForNotebookScope, type NotebookQuranScope, type PublishedNotebookRevision,
} from '../notebookContracts';
import { parseQuranAyahRegions, quranPageMetadataUrl } from '../quranSource';
import type { QuranInkStroke, QuranTarget } from '../quranAnnotations';
import type { InkMode } from './QuranInk';
import { ReaderPrintedPage } from './ReaderPrintedPage';
import css from './LessonQuranViewer.module.css';

type PageState =
  | { status: 'loading' | 'invalid'; page: number; scope: NotebookQuranScope | null; keys: null }
  | { status: 'ready'; page: number; scope: NotebookQuranScope; keys: ReadonlySet<string> };

async function loadPageRegions(page: number, signal: AbortSignal) {
  let data: unknown;
  try {
    const response = await fetch(quranPageMetadataUrl(page), { signal });
    if (!response.ok) throw new Error('Primary Quran metadata unavailable');
    data = await response.json() as unknown;
  } catch (error) {
    if (signal.aborted) throw error;
    const response = await fetch(quranPageMetadataUrl(page, true), { signal });
    if (!response.ok) throw new Error('Quran metadata unavailable');
    data = await response.json() as unknown;
  }
  return parseQuranAyahRegions(data);
}

/**
 * The teacher's published layer is immutable. Personal pen/marker strokes live only
 * in this mounted lesson viewer; changing lesson, revision or learner discards them.
 * Neither layer modifies the canonical Quran image or submits anything to a server.
 */
export function LessonQuranViewer({ revision }: { revision: PublishedNotebookRevision | null }) {
  const scope = revision?.scope ?? null;
  const [page, setPage] = useState(scope?.start.page ?? 1);
  const [state, setState] = useState<PageState>({
    status: 'loading', page: scope?.start.page ?? 1, scope, keys: null,
  });
  const [selected, setSelected] = useState<QuranTarget | null>(null);
  const [showTeacher, setShowTeacher] = useState(true);
  const [inkMode, setInkMode] = useState<InkMode>('off');
  const [privateInk, setPrivateInk] = useState<Readonly<Record<number, readonly QuranInkStroke[]>>>({});

  useEffect(() => {
    if (!scope) return;
    const controller = new AbortController();
    setState({ status: 'loading', page, scope, keys: null });
    setSelected(null);
    void loadPageRegions(page, controller.signal).then((regions) => {
      if (controller.signal.aborted) return;
      const keys = pageKeysForNotebookScope(scope, page, regions);
      setState(keys
        ? { status: 'ready', page, scope, keys }
        : { status: 'invalid', page, scope, keys: null });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'invalid', page, scope, keys: null });
    });
    return () => controller.abort();
  }, [page, scope]);

  const verified = state.page === page && state.scope === scope;
  const ready = verified && state.status === 'ready';
  const invalid = verified && state.status === 'invalid';
  const marks = useMemo(() => revision?.approvedAnnotations.filter((mark) =>
    mark.type === 'teacher' && mark.published
  ) ?? [], [revision]);
  // The revision has already been learner/lesson-filtered by latestPublishedNotebook.
  const pageMarks = ready && showTeacher ? marks.filter((mark) =>
    mark.target.page === page && state.keys?.has(mark.target.surah + ':' + mark.target.ayah)) : [];
  const noteKeys = new Set(pageMarks.map((mark) => mark.target.surah + ':' + mark.target.ayah));
  const selectedKey = selected ? selected.surah + ':' + selected.ayah : null;
  const strokes = privateInk[page] ?? [];

  function updatePrivateInk(inkPage: number, next: QuranInkStroke[]) {
    // Keep all private ink page-bound and bounded. It never enters a published revision.
    if (inkPage !== page || !ready) return;
    setPrivateInk((previous) => ({
      ...previous, [inkPage]: next.filter((stroke) => stroke.page === inkPage).slice(-100),
    }));
  }
  function undoPrivateInk() {
    setPrivateInk((previous) => ({ ...previous, [page]: (previous[page] ?? []).slice(0, -1) }));
  }
  function clearPrivateInk() {
    setPrivateInk((previous) => ({ ...previous, [page]: [] }));
  }
  function select(target: QuranTarget) {
    if (ready && state.keys?.has(target.surah + ':' + target.ayah)) setSelected(target);
  }

  if (!scope || !revision) return <p role="status" className={css.notice}>
    لم يُنشر نطاق آيات موثّق لهذه الحصة بعد. لا نعرض علامات أو صفحات منسوبة للشيخ دون مصدر.
  </p>;

  return <section className={css.viewer} aria-label="مصحف الحصة المنشور للقراءة فقط">
    <div className={css.heading}>
      <strong>آيات الحصة · علامات الشيخ للقراءة فقط</strong>
      <small>علامات الشيخ المنشورة لا يمكن تعديلها أو مسحها. الرسم الشخصي منفصل ومؤقت.</small>
    </div>
    <nav className={css.navigation} aria-label="صفحات نطاق الحصة">
      <button type="button" disabled={page <= scope.start.page} onClick={() => setPage((n) => n - 1)}>الصفحة السابقة</button>
      <span aria-live="polite">صفحة {page} من {scope.start.page} إلى {scope.end.page}</span>
      <button type="button" disabled={page >= scope.end.page} onClick={() => setPage((n) => n + 1)}>الصفحة التالية</button>
    </nav>
    {!ready && !invalid && <p role="status" className={css.notice}>جار التحقق من مواضع الآيات في مصدر المصحف…</p>}
    {invalid && <p role="alert" className={css.notice}>
      تعذّر التحقق من مواضع الآيات لهذه الصفحة. لن نعرض نطاقًا أو علامات غير موثّقة.
    </p>}
    {ready && <div className={css.layerControls} role="group" aria-label="طبقات مصحف الحصة">
      <button type="button" aria-pressed={showTeacher} onClick={() => setShowTeacher((value) => !value)}>
        {showTeacher ? 'إخفاء علامات الشيخ' : 'إظهار علامات الشيخ'}
      </button>
      <button type="button" aria-pressed={inkMode === 'off'} onClick={() => setInkMode('off')}>قراءة الآيات</button>
      <button type="button" aria-pressed={inkMode === 'pen'} onClick={() => setInkMode('pen')}>قلم خاص</button>
      <button type="button" aria-pressed={inkMode === 'marker'} onClick={() => setInkMode('marker')}>محدد خاص</button>
      <button type="button" aria-pressed={inkMode === 'eraser'} onClick={() => setInkMode('eraser')}>ممحاة خاصة</button>
      <button type="button" disabled={strokes.length === 0} onClick={undoPrivateInk}>تراجع عن آخر خط</button>
      <button type="button" disabled={strokes.length === 0} onClick={clearPrivateInk}>مسح رسومي في الصفحة</button>
    </div>}
    {ready && <p className={css.notice}>
      الرسوم الشخصية محلية ومؤقتة وغير محفوظة؛ تختفي عند مغادرة الدفتر أو تبديل الحصة أو الطالب.
      استخدم «قراءة الآيات» للعودة لتحديد الآيات بدل الرسم.
    </p>}
    {ready && <div className={css.page}>
      <ReaderPrintedPage page={page} inkMode={inkMode} color="#AD8028" strokes={strokes}
        selectedKey={selectedKey} noteKeys={noteKeys} allowedKeys={state.keys}
        onSelect={select} onOpenNote={select} onInkChange={updatePrivateInk} />
    </div>}
    {ready && <div className={css.marks}>
      <strong>تصحيحات الشيخ المنشورة لهذه الصفحة</strong>
      {showTeacher ? (pageMarks.length ? pageMarks.map((mark) => <button type="button" key={mark.id}
        className={css.mark} onClick={() => select(mark.target)}>
        <span>الآية {mark.target.surah}:{mark.target.ayah}</span>
        <span>{mark.text}</span>
      </button>) : <p className={css.notice}>لا توجد علامات منشورة لهذه الصفحة.</p>)
        : <p className={css.notice}>علامات الشيخ مخفية مؤقتًا من العرض؛ لم تُعدّل أو تُحذف.</p>}
      {selected && <p role="status" className={css.notice}>الآية المحددة: {selected.surah}:{selected.ayah}</p>}
    </div>}
  </section>;
}
