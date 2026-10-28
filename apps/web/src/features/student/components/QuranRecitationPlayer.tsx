'use client';

import { useEffect, useRef, useState } from 'react';
import {
  QURAN_RECITERS, createQuranAudioSequence, formatAudioClock,
  quranAudioKey, reciterAudioUrl, type QuranAudioRequest, type QuranAudioScope,
  type QuranReciterId
} from '../quranReciters';
import type { QuranAyahReference, QuranSurahInfo } from '../quranSource';
import { ReaderIcon } from './ReaderIcon';
import css from './QuranRecitationPlayer.module.css';

type Props = {
  request: QuranAudioRequest;
  pageVerses: readonly QuranAyahReference[];
  surahs: readonly QuranSurahInfo[];
  onVerseChange: (verse: QuranAyahReference | null) => void;
  onClose: () => void;
};
type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'complete';
const speeds = [0.75, 1, 1.25, 1.5] as const;
const repeatModes = [1,3,5] as const;

/** All media stays on an HTMLAudioElement: no client API keys, no DB, no audio copying. */
export function QuranRecitationPlayer({ request, pageVerses, surahs, onVerseChange, onClose }: Props) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const queue = useRef<QuranAyahReference[]>([]);
  const position = useRef(0);
  const completedRepeats = useRef(0);
  const [reciter, setReciter] = useState<QuranReciterId>('alafasy');
  const [scope, setScope] = useState<QuranAudioScope>(request.scope);
  const [speed, setSpeed] = useState<number>(1);
  const [repeat, setRepeat] = useState<1|3|5>(1);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<QuranAyahReference | null>(null);
  const [index, setIndex] = useState(0);
  const [queueLength, setQueueLength] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // An explicit verse click changes the requested starting point but does not autoplay.
    audio.current?.pause();
    queue.current = [];
    position.current = 0;
    completedRepeats.current = 0;
    setScope(request.scope);
    setStatus('idle'); setError('');
    setElapsed(0); setDuration(0); setCurrent(null); setQueueLength(0);
    onVerseChange(null);
  // Deliberately reset only for a new explicit request, not on a page/image redraw.
  }, [request.token]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed]);

  function playElement() {
    const element = audio.current;
    if (!element) return;
    setError('');setStatus('loading');
    const result = element.play();
    if (result) void result.then(() => setStatus('playing')).catch(() => {
      setStatus('paused');
      setError('المتصفح منع التشغيل التلقائي أو تعذر فتح الصوت. اضغط تشغيل مرة أخرى.');
    });
  }

  function loadAt(nextIndex: number, chosen = reciter) {
    const selected = queue.current[nextIndex];
    const element = audio.current;
    if (!selected || !element) return;
    position.current = nextIndex;
    completedRepeats.current = 0;
    setIndex(nextIndex);setCurrent(selected);setElapsed(0);setDuration(0);
    onVerseChange(selected);
    element.pause();
    element.src = reciterAudioUrl(chosen, selected.surah, selected.ayah);
    element.playbackRate = speed;
    element.load();
    playElement();
  }

  function start() {
    const sequence = createQuranAudioSequence(scope, pageVerses, surahs, request.ayah);
    if (!sequence.length) {
      setStatus('error');
      setError(scope === 'page' ? 'مواضع آيات الصفحة لم تكتمل بعد؛ جرّب مرة أخرى.' :
        'فهرس السورة أو الآية غير جاهز. افتح الآية أولًا ثم جرّب التشغيل.');
      return;
    }
    queue.current = sequence;
    setQueueLength(sequence.length);
    loadAt(0);
  }

  function pauseOrPlay() {
    const element = audio.current;
    if (!element) return;
    if (status === 'playing' || status === 'loading') {
      element.pause();setStatus('paused');
    } else if (queue.current.length && element.src && status !== 'complete' && status !== 'error') {
      playElement();
    } else start();
  }

  function skip(direction: -1|1) {
    if (!queue.current.length) { start(); return; }
    const target=Math.max(0,Math.min(queue.current.length-1,position.current+direction));
    loadAt(target);
  }

  function ended() {
    const element = audio.current;
    if (!element) return;
    if (completedRepeats.current + 1 < repeat) {
      completedRepeats.current++;
      element.currentTime = 0;
      playElement();
      return;
    }
    const next = position.current + 1;
    if (next >= queue.current.length) {
      setStatus('complete');
      setElapsed(duration);onVerseChange(null);
      return;
    }
    loadAt(next);
  }

  function chooseReciter(value: QuranReciterId) {
    setReciter(value);
    if (queue.current.length) loadAt(position.current, value);
  }
  function close() {
    audio.current?.pause(); onVerseChange(null); onClose();
  }

  return <section className={css.dock} aria-label="مشغل التلاوة" dir="rtl" data-compact-player={!expanded}>
    <audio ref={audio} preload="none"
      onEnded={ended}
      onTimeUpdate={event => setElapsed(event.currentTarget.currentTime)}
      onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onWaiting={() => setStatus('loading')}
      onPlaying={() => setStatus('playing')}
      onPause={() => setStatus(s => s === 'playing' ? 'paused' : s)}
      onError={() => { setStatus('error');setError('تعذر تحميل تسجيل هذه الآية من مصدر التلاوة. جرّب قارئًا آخر.'); }}
    />
    <div className={css.primaryRow}>
      <button type="button" className={css.playButton}
        aria-label={status==='playing'?'إيقاف مؤقت':'تشغيل التلاوة'} onClick={pauseOrPlay}>
        <ReaderIcon name={status==='playing'?'pause':'play'} />
      </button>
      <button type="button" className={css.action} aria-label="الآية السابقة" title="الآية السابقة"
        disabled={!queueLength||index===0} onClick={() => skip(-1)}>‹</button>
      <button type="button" className={css.action} aria-label="الآية التالية" title="الآية التالية"
        disabled={!queueLength||index===queueLength-1} onClick={() => skip(1)}>›</button>
      <div className={css.nowPlaying}>
        <strong>{QURAN_RECITERS.find(r => r.id===reciter)?.name}</strong>
        <span>{current ? 'الآية '+quranAudioKey(current)+' · '+(index+1)+'/'+queueLength :
          status==='complete'?'اكتملت التلاوة':'اختر النطاق واضغط تشغيل'}</span>
      </div>

      <button type="button" className={css.detailsButton} aria-label="إعدادات التلاوة المتقدمة"
        title="اختيار القارئ والتكرار والسرعة" aria-expanded={expanded}
        aria-controls="quran-audio-advanced" onClick={() => setExpanded(v=>!v)}>
        <ReaderIcon name="settings" />
      </button>
      <button type="button" className={css.closeButton} aria-label="إغلاق مشغل التلاوة" onClick={close}>×</button>
    </div>
    <div className={css.miniProgress} aria-hidden="true">
      <span style={{width:duration>0?Math.max(0,Math.min(100,elapsed/duration*100))+'%':'0%'}} />
    </div>
    <div id="quran-audio-advanced" className={css.advanced} hidden={!expanded}>
      <h3>خيارات التلاوة</h3>
      <label className={css.selectLabel}>القارئ
        <select aria-label="اختيار القارئ" value={reciter}
          onChange={e => chooseReciter(e.target.value as QuranReciterId)}>
          {QURAN_RECITERS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <div className={css.secondaryRow}>
      <label>النطاق
        <select aria-label="نطاق التلاوة" value={scope}
          onChange={e => {audio.current?.pause();queue.current=[];setQueueLength(0);setStatus('idle');setScope(e.target.value as QuranAudioScope);}}>
          <option value="ayah">الآية المحددة</option>
          <option value="page">الصفحة الحالية</option>
          <option value="surah">السورة كاملة</option>
        </select>
      </label>
      <label>تكرار الآية
        <select aria-label="عدد مرات التكرار" value={repeat}
          onChange={e => {completedRepeats.current=0;setRepeat(Number(e.target.value) as 1|3|5);}}>
          {repeatModes.map(n => <option key={n} value={n}>{n}×</option>)}
        </select>
      </label>
      <label>السرعة
        <select aria-label="سرعة التلاوة" value={speed}
          onChange={e => setSpeed(Number(e.target.value))}>
          {speeds.map(n => <option key={n} value={n}>{n}×</option>)}
        </select>
      </label>
      <div className={css.progress}>
        <span>{formatAudioClock(elapsed)}</span>
        <input type="range" min="0" max={duration||1} step=".2" value={Math.min(elapsed,duration||1)}
          aria-label="موضع التلاوة" disabled={!duration}
          onChange={e => {if (audio.current && duration) audio.current.currentTime=Number(e.target.value);}} />
        <span>{formatAudioClock(duration)}</span>
      </div>
    </div>
      <span className={css.attribution}>بث صوتي مباشر من EveryAyah، بدون نسخ التسجيلات أو رفعها إلى R2.</span>
    </div>
    {error && <p className={css.error} role="alert">{error}</p>}
    {status==='loading'&&!error && <span className={css.loading} role="status">جار تحميل التلاوة…</span>}
  </section>;
}
