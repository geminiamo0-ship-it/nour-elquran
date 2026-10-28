import type { InputHTMLAttributes } from 'react';
import styles from './Field.module.css';

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function Field({ id, label, hint, error, required, 'aria-describedby': describedBy, ...inputProps }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const description = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
      <input {...inputProps} id={id} required={required} aria-required={required || undefined}
        aria-invalid={Boolean(error) || undefined} aria-describedby={description} className={styles.input} />
      {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
