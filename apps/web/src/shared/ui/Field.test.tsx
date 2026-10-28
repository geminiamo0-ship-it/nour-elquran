import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Field } from './Field';
import { Card } from './Card';

describe('shared UI primitives', () => {
  it('associates an accessible label and required state with its input', () => {
    const html = renderToStaticMarkup(<Field id="guardian-phone" label="رقم الهاتف" required hint="رقم ولي الأمر" />);
    expect(html).toContain('for="guardian-phone"');
    expect(html).toContain('id="guardian-phone"');
    expect(html).toContain('required=""');
    expect(html).toContain('guardian-phone-hint');
  });
  it('announces validation errors without relying on color', () => {
    const html = renderToStaticMarkup(<Field id="phone" label="الهاتف" error="الرقم غير صحيح" />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('phone-error');
  });
  it('supports semantic article cards', () => {
    expect(renderToStaticMarkup(<Card as="article">برنامج الحفظ</Card>)).toContain('<article');
  });
});
