/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/image', () => ({
  default: ({
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Next Image is mocked as a plain image in DOM tests.
    <img {...props} />
  ),
}));

afterEach(() => cleanup());

describe('custom not-found page', () => {
  it('renders the default 404 with the brand mark and a way home', async () => {
    const { NotFoundPage } = await import('./NotFoundPage');
    const { container } = render(<NotFoundPage description="That page does not exist." />);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(screen.getByText('That page does not exist.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to home' }).getAttribute('href')).toBe('/');
    expect(container.querySelector('img[src="/shopping-bag.svg"]')).not.toBeNull();
    // Custom design, not the framework default text.
    expect(screen.queryByText(/This page could not be found/)).toBeNull();
  });

  it('shows the workspace message used for retailer and entrepreneur accounts', async () => {
    const { default: DashboardNotFound } = await import('@/app/dashboard/not-found');
    render(<DashboardNotFound />);

    expect(
      screen.getByRole('heading', { name: "This workspace isn't available yet" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Retailer and Entrepreneur workspaces are still being built/),
    ).toBeTruthy();
    expect(
      screen.getByText('For now, only the Supplier dashboard is available on Sellonit.'),
    ).toBeTruthy();
  });
});
