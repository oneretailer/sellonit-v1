import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BagMark } from './BagMark';

describe('BagMark', () => {
  it('renders a decorative SVG and accepts sizing classes', () => {
    const html = renderToStaticMarkup(<BagMark className="w-9 sm:w-14 text-primary" />);
    expect(html).toContain('<svg');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('w-9 sm:w-14');
    expect(html).toContain('text-primary');
    expect(html).toContain('viewBox="0 0 56 60"');
  });

  it('exposes an accessible image when a title is supplied', () => {
    const html = renderToStaticMarkup(<BagMark title="Sellonit bag" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('<title id="bag-mark-title">Sellonit bag</title>');
  });
});
