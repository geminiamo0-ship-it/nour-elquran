'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { clampQuranPage, quranPageUrl } from '../quranSource';
import css from './SmoothMadinahPage.module.css';

type CachedPage = { url: string; lastUsed: number };
const ready = new Map<number, CachedPage>();
const inflight = new Map<number, Promise<string>>();
const CACHE_LIMIT = 14;

export function nearbyPages(page: number, radius = 5): number[] {
  const current = clampQuranPage(page);
  const result = [current];
  for (let n = 1; n <= radius; n++) {
    if (current + n <= 604) result.push(current + n);
    if (current - n >= 1) result.push(current - n);
  }
  return result;
}

function store(page: number, url: string): string {
  ready.delete(page);
  ready.set(page, { url, lastUsed: Date.now() });
  while (ready.size > CACHE_LIMIT) ready.delete(ready.keys().next().value!);
  return url;
}

function tryImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (typeof image.decode === 'function') {
        void image.decode().then(resolve).catch(() => resolve());
      } else resolve();
    };
    image.onerror = () => reject(new Error('Quran page download failed'));
    image.src = url;
    if (image.complete && image.naturalWidth > 0) resolve();
  });
}

export function loadQuranPage(page: number): Promise<string> {
  const normalized = clampQuranPage(page);
  const existing = ready.get(normalized);
  if (existing) return Promise.resolve(store(normalized, existing.url));
  const pending = inflight.get(normalized);
  if (pending) return pending;
  const primary = quranPageUrl(normalized);
  const fallback = quranPageUrl(normalized, true);
  const promise = tryImage(primary)
    .then(() => store(normalized, primary))
    .catch(async () => { await tryImage(fallback); return store(normalized, fallback); })
    .finally(() => inflight.delete(normalized));
  inflight.set(normalized, promise);
  return promise;
}

export function preloadNeighborPages(page: number, radius: number): void {
  const neighbors = nearbyPages(page, radius).slice(1);
  // Limit simultaneous downloads on mobile; the displayed page always has first priority.
  const queue = neighbors.slice();
  let active = 0;
  const advance = () => {
    while (active < 3 && queue.length > 0) {
      const next = queue.shift()!;
      active++;
      void loadQuranPage(next).catch(() => undefined).finally(() => { active--; advance(); });
    }
  };
  advance();
}

export function SmoothMadinahPage({ page, overlay, viewportFit = false, concealArtwork = false }: { page: number; overlay?: ReactNode; viewportFit?: boolean; concealArtwork?: boolean }) {
  const [shown, setShown] = useState<{ page: number; url: string } | null>(null);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setPending(true);
    setFailed(false);
    void loadQuranPage(page).then((url) => {
      if (!active) return;
      setShown({ page, url });
      setPending(false);
      // 2 behind, 4 ahead on limited networks; up to 10 other pages on fast devices.
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      const radius = connection?.saveData || connection?.effectiveType === '2g' ? 2 : 5;
      preloadNeighborPages(page, radius);
    }).catch(() => {
      if (active) { setPending(false); setFailed(true); }
    });
    return () => { active = false; };
  }, [page]);

  return <div className={[css.frame, viewportFit ? css.viewportFrame : ''].join(' ')} aria-busy={pending}>
    <div className={css.sheet} role="group" aria-label={'مصحف المدينة، الصفحة ' + page}>
      {shown && <div key={shown.page} data-rendered-quran-page={shown.page} className={[css.artwork,shown.page<=2?css.opening:''].join(' ')}>
        <img className={css.image} src={shown.url}
          alt={'صفحة ' + shown.page + ' من مصحف المدينة'}
          width={345} height={550} draggable={false} />
        {shown.page === page ? overlay : concealArtwork ?
         <span className={css.privacyCover} aria-label="المصحف مخفي أثناء تحميل الصفحة المطلوبة"/> : null}
        <span className={css.turnSheen} aria-hidden="true" />
      </div>}
      {!shown && <div className={css.placeholder} role="status">جار تجهيز صفحة المصحف…</div>}
      {pending && shown && <div className={css.pending} role="status">جار تجهيز الصفحة {page}…</div>}
      {failed && <div className={css.failed} role="alert">تعذر فتح الصفحة {page}. الصفحة السابقة محفوظة للقراءة؛ حاول مرة أخرى.</div>}
    </div>
    <div className={css.caption} aria-live="polite">
      {pending ? 'الصفحة الحالية ثابتة أثناء تجهيز الصفحة التالية' : 'الصفحة ' + page + ' من 604'}
    </div>
  </div>;
}
