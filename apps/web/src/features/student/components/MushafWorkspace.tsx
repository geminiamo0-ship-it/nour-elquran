'use client';

import { MadinahReader } from './MadinahReader';
import styles from '../StudentPortal.module.css';

/** Quran is composed from native React components. No HTML injection or guessed verses. */
export function MushafWorkspace() {
  return <div className={styles.workspace}>
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><p className={styles.eyebrow}>مصحف المدينة · حفص عن عاصم</p>
          <h2>المصحف الشريف التفاعلي</h2></div>
        <span className={styles.statusNeutral}>604 صفحة · نص قرآني موثّق</span>
      </div>
      <MadinahReader />
    </section>
  </div>;
}
