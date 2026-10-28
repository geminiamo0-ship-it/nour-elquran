import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Alert.module.css';

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: 'info' | 'success' | 'error';
};

export function Alert({ children, tone = 'info', className, ...props }: AlertProps) {
  return (
    <div {...props} role={tone === 'error' ? 'alert' : 'status'}
      className={[styles.alert, styles[tone], className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
