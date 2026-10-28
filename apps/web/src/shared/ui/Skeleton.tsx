import styles from './Skeleton.module.css';

export type SkeletonProps = { width?: string; height?: string; label?: string };

export function Skeleton({ width = '100%', height = '1rem', label = 'جارٍ التحميل' }: SkeletonProps) {
  return <span role="status" aria-label={label} className={styles.skeleton} style={{ width, height }} />;
}
