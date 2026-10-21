import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BagMark } from './BagMark';

describe('BagMark', () => {
  it('renders a decorative bag image', () => {
    const html = renderToStaticMarkup(<BagMark />);
    expect(html).toContain('src="/shopping-bag.svg"');
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
  });

  it('exposes an accessible image when a title is supplied', () => {
    const html = renderToStaticMarkup(<BagMark title="Sellonit bag" />);
    expect(html).toContain('alt="Sellonit bag"');
    expect(html).not.toContain('aria-hidden="true"');
  });
});
