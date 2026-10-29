'use client';

import { useEffect, useMemo, useState } from 'react';
import { pageKeysForNotebookScope, type PublishedNotebookRevision } from '../notebookContracts';
import { parseQuranAyahRegions, quranPageMetadataUrl } from '../quranSource';
import type { QuranTarget } from '../quranAnnotations';
import { ReaderPrintedPage } from './ReaderPrintedPage';
import css from './LessonQuranViewer.module.css';

type PageState =
  | { status: 'loading' | 'invalid'; keys: null }
  | { status: 'ready'; keys: ReadonlySet<string> };

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

/** Read-only, publisher-checked page projection. It never writes to teacher marks. */
export function LessonQuranViewer({ revision }: { revision: PublishedNotebookRevision | null }) {
  const scope = revision?.scope ?? null;
  const [page, setPage] = useState(scope?.start.page ?? 1);
  const [state, setState] = useState<PageState>({ status: 'loading', keys: null });
  const [selected, setSelected] = useState<QuranTarget | null>(null);

  useEffect(() => {
    if (!scope) return;
    const controller = new AbortController();
    setState({ status: 'loading', keys: null });
    setSelected(null);
    void loadPageRegions(page, controller.signal).then((regions) => {
      if (controller.signal.aborted) return;
      const keys = pageKeysForNotebookScope(scope, page, regions);
      setState(keys ? { status: 'ready', keys } : { status: 'invalid', keys: null });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'invalid', keys: null });
    });
    return () => controller.abort();
  }, [page, scope]);

  const marks = useMemo(() => revision?.approvedAnnotations.filter((mark) =>
    mark.type === 'teacher' && mark.published
  ) ?? [], [revision]);
  // The revision has already been learner/lesson-filtered by latestPublishedNotebook.
  const pageMarks = marks.filter((mark) =>
    mark.target.page === page && state.status === 'ready' &&
    state.keys.has(mark.target.surah + ':' + mark.target.ayah));
  const noteKeys = new Set(pageMarks.map((mark) => mark.target.surah + ':' + mark.target.ayah));
  const selectedKey = selected ? selected.surah + ':' + selected.ayah : null;

  if (!scope || !revision) return <p role="status" className={css.notice}>
    لم يُنشر نطاق آيات موثّق لهذه الحصة بعد. لا نعرض علامات أو صفحات منسوبة للشيخ دون مصدر.
  </p>;

  function select(target: QuranTarget) {
    if (state.status === 'ready' && state.keys.has(target.surah + ':' + target.ayah)) setSelected(target);
  }

  return <section className={css.viewer} aria-label="مصحف الحصة المنشور للقراءة فقط">
    <div className={css.heading}>
      <strong>آيات الحصة · قراءة فقط</strong>
      <small>علامات الشيخ المعتمدة فقط؛ لا يمكن تعديلها أو مسحها هنا.</small>
    </div>
    <nav className={css.navigation} aria-label="صفحات نطاق الحصة">
      <button type="button" disabled={page <= scope.start.page} onClick={() => setPage((n) => n - 1)}>الصفحة السابقة</button>
      <span aria-live="polite">صفحة {page} من {scope.start.page} إلى {scope.end.page}</span>
      <button type="button" disabled={page >= scope.end.page} onClick={() => setPage((n) => n + 1)}>الصفحة التالية</button>
    </nav>
    {state.status === 'loading' && <p role="status" className={css.notice}>جار التحقق من مواضع الآيات في مصدر المصحف…</p>}
    {state.status === 'invalid' && <p role="alert" className={css.notice}>
      تعذّر التحقق من مواضع الآيات لهذه الصفحة. لن نعرض نطاقًا أو علامات غير موثّقة.
    </p>}
    {state.status === 'ready' && <div className={css.page}>
      <ReaderPrintedPage page={page} inkMode="off" color="#AD8028" strokes={[]}
        selectedKey={selectedKey} noteKeys={noteKeys} allowedKeys={state.keys}
        onSelect={select} onOpenNote={select} onInkChange={() => undefined} />
    </div>}
    {state.status === 'ready' && <div className={css.marks}>
      <strong>تصحيحات الشيخ المنشورة لهذه الصفحة</strong>
      {pageMarks.length ? pageMarks.map((mark) => <button type="button" key={mark.id}
        className={css.mark} onClick={() => select(mark.target)}>
        <span>الآية {mark.target.surah}:{mark.target.ayah}</span>
        <span>{mark.text}</span>
      </button>) : <p className={css.notice}>لا توجد علامات منشورة لهذه الصفحة.</p>}
      {selected && <p role="status" className={css.notice}>الآية المحددة: {selected.surah}:{selected.ayah}</p>}
    </div>}
  </section>;
}
