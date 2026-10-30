'use client';

import {useState} from 'react';
import {ReaderPrintedPage} from '@/features/student';
import {LiveLessonMedia} from './LiveLessonMedia';
import type {RoomIdentity} from './media-credentials';
import css from './SignedClassroom.module.css';

const EMPTY_MARKS = new Set<string>();
const NO_STROKES = [] as const;
const noop = () => undefined;

/**
 * Signed lesson viewport. Presence and media remain server-authorized;
 * Quran browsing here is deliberately local/read-only until the LessonDO
 * publishes an authoritative page and ink stream (#194/#50).
 */
export function SignedClassroomStage({identity,active}:{
  identity:RoomIdentity;active:boolean;
}){
  const [page,setPage]=useState(1);
  return <div className={css.stage} data-role={identity.role}>
    <aside className={css.mediaDock} aria-label="كاميرا وصوت الحصة">
      <LiveLessonMedia identity={identity} active={active} compact/>
    </aside>
    <section className={css.quranPane} aria-label="المصحف المعتمد للقراءة">
      <div className={css.quranBar}>
        <strong>المصحف · حفص</strong>
        <nav aria-label="تصفح المصحف محليًا" className={css.pageNav}>
          <button type="button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>السابق</button>
          <span aria-live="polite">صفحة {page} / 604</span>
          <button type="button" disabled={page>=604} onClick={()=>setPage(p=>Math.min(604,p+1))}>التالي</button>
        </nav>
      </div>
      <div className={css.quranViewport} data-quran-layout="viewport-fit">
        <ReaderPrintedPage page={page} viewportFit inkMode="off" color="#ad8028"
          strokes={NO_STROKES} selectedKey={null} noteKeys={EMPTY_MARKS}
          onSelect={noop} onOpenNote={noop} onInkChange={noop}/>
      </div>
      <p className={css.quranNotice}>تصفح محلي للقراءة فقط · الصفحة والرسم لا يتزامنان مع الطرف الآخر بعد.</p>
    </section>
  </div>;
}
