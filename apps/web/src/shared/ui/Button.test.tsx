import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './Button';

describe('Button', () => {
  it('defaults to a non-submitting button', () => {
    const html = renderToStaticMarkup(<Button>ابدأ الآن</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain('ابدأ الآن');
  });

  it('supports native disabled and explicit submit semantics', () => {
    const html = renderToStaticMarkup(<Button type="submit" disabled>تسجيل</Button>);
    expect(html).toContain('type="submit"');
    expect(html).toContain('disabled=""');
  });
});
