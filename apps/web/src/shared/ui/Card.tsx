import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: 'article' | 'section' | 'div';
};

export function Card({ as: Element = 'div', children, className, ...props }: CardProps) {
  return <Element {...props} className={[styles.card, className].filter(Boolean).join(' ')}>{children}</Element>;
}
