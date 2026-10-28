import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Alert } from './Alert';
import { EmptyState } from './EmptyState';

describe('feedback UI', () => {
  it('announces errors assertively', () => {
    expect(renderToStaticMarkup(<Alert tone="error">تعذر الحفظ</Alert>)).toContain('role="alert"');
  });
  it('exposes informational feedback as status', () => {
    expect(renderToStaticMarkup(<Alert>تم التحديث</Alert>)).toContain('role="status"');
  });
  it('renders empty-state heading and action', () => {
    const html = renderToStaticMarkup(<EmptyState title="لا توجد حصص" action={<a href="/dashboard">العودة</a>} />);
    expect(html).toContain('<h2');
    expect(html).toContain('العودة');
  });
});
