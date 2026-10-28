import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Skeleton } from './Skeleton';
import { PageContainer } from './PageContainer';

describe('layout and loading primitives', () => {
  it('labels loading status', () => {
    const html = renderToStaticMarkup(<Skeleton label="تحميل الحصص" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('تحميل الحصص');
  });
  it('renders a reusable container', () => {
    expect(renderToStaticMarkup(<PageContainer>المحتوى</PageContainer>)).toContain('المحتوى');
  });
});
