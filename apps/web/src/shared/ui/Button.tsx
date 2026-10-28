import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export function Button({ children, className, variant = 'primary', type = 'button', ...props }: ButtonProps) {
  const variantClass = variant === 'primary' ? styles.primary : styles.secondary;
  return (
    <button
      {...props}
      type={type}
      className={[styles.button, variantClass, className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}
