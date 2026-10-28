import type { ReactNode } from 'react';
import styles from './SurfaceCard.module.css';

type SurfaceCardProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

export function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
  return <section className={`${styles.card} ${className}`.trim()}>{children}</section>;
}
