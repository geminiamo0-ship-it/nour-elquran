import type { HTMLAttributes, ReactNode } from 'react';
import styles from './PageContainer.module.css';

export type PageContainerProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function PageContainer({ children, className, ...props }: PageContainerProps) {
  return <div {...props} className={[styles.container, className].filter(Boolean).join(' ')}>{children}</div>;
}
