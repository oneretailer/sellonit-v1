/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductsListPage } from './ProductsListPage';
import { navMocks, polyfillProductsEnv, renderProducts, resetProductsMocks } from './testSupport';
import { productsApi } from '@/lib/products/productsApi';
import { SAMPLE_PRODUCTS } from '@/lib/products/devMockProducts';
import { ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE, NetworkError } from '@/lib/api-client';
import type { Paginated, Product, ProductSummary } from '@/lib/products/types';

vi.mock('next/navigation', async () => (await import('./testState')).navigationMockFactory());
vi.mock('@/lib/business/BusinessProvider', async () =>
  (await import('./testState')).businessMockFactory(),
);
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({
      href,
      children,
      ...props
    }: { href: unknown; children?: React.ReactNode } & Record<string, unknown>) =>
      React.createElement('a', { href: String(href), ...props }, children),
  };
});

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Cotton polo shirt',
    description: 'Soft pique cotton polo in a regular fit.',
    category: 'Tops',
    sku: 'SF-PS-022',
    wholesalePrice: 750000,
    stockQuantity: 60,
    status: 'published',
    images: [{ id: 'img-1', url: 'https://cdn.example/polo.jpg' }],
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    ...overrides,
  };
}

function page(rows: readonly Product[], total = rows.length): Paginated<Product> {
  return {
    data: [...rows],
    meta: { page: 1, pageSize: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) },
  };
}

const summary: ProductSummary = {
  total: 125,
  published: 112,
  drafts: 13,
  lowStock: 3,
  outOfStock: 1,
};

beforeEach(() => {
  resetProductsMocks();
  polyfillProductsEnv();
  vi.spyOn(productsApi, 'summary').mockResolvedValue(summary);
  vi.spyOn(productsApi, 'getCategories').mockResolvedValue([
    { id: 'Tops', name: 'Tops' },
    { id: 'Bottoms', name: 'Bottoms' },
    { id: 'Accessories', name: 'Accessories' },
  ]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('products list', () => {
  it('renders sample rows with en-NG formatted Naira prices, stock states, status chips, and range footer', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page(SAMPLE_PRODUCTS, 125));
    renderProducts(<ProductsListPage />);
    await waitFor(() => expect(screen.getAllByText('Cotton polo shirt').length).toBeGreaterThan(0));
    expect(screen.getAllByText('₦7,500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₦14,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('60 in stock').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 left').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Out of stock').length).toBeGreaterThan(0);
    expect(screen.getByText('Showing 1–6 of 125 products')).toBeTruthy();
    expect(screen.getByText('112 published · 13 drafts')).toBeTruthy();
    const tabs = screen.getByRole('tablist', { name: 'Product status' });
    expect(within(tabs).getByRole('tab', { name: /All/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('shows the true-empty state with an Add product action when there are no products', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([]));
    vi.spyOn(productsApi, 'summary').mockResolvedValue({
      total: 0,
      published: 0,
      drafts: 0,
      lowStock: 0,
      outOfStock: 0,
    });
    renderProducts(<ProductsListPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'No products yet' })).toBeTruthy(),
    );
    expect(screen.getAllByRole('link', { name: 'Add product' }).length).toBeGreaterThan(0);
  });

  it('shows the filter-empty state with Clear filters when filters are active', async () => {
    navMocks.search = 'q=nonexistent';
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([]));
    renderProducts(<ProductsListPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'No products match your filters' })).toBeTruthy(),
    );
    const userEventSession = userEvent.setup();
    await userEventSession.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/products', { scroll: false });
  });

  it('shows the error state with a Retry button and refetches', async () => {
    const userEventSession = userEvent.setup();
    const list = vi
      .spyOn(productsApi, 'list')
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValue(page([product()]));
    renderProducts(<ProductsListPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: "We couldn't load your products" })).toBeTruthy(),
    );
    await userEventSession.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getAllByText('Cotton polo shirt').length).toBeGreaterThan(0));
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('debounces search into the URL and resets the page', async () => {
    navMocks.search = 'page=3';
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([product()]));
    renderProducts(<ProductsListPage />);
    const userEventSession = userEvent.setup();
    const box = await screen.findByRole('searchbox', { name: 'Search by product name or SKU' });
    await userEventSession.type(box, 'polo');
    expect(navMocks.replace).not.toHaveBeenCalled();
    await waitFor(
      () =>
        expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/products?q=polo', {
          scroll: false,
        }),
      { timeout: 2000 },
    );
  });

  it('switches tab and pages through the URL', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page(SAMPLE_PRODUCTS, 25));
    renderProducts(<ProductsListPage />);
    const userEventSession = userEvent.setup();
    await userEventSession.click(await screen.findByRole('tab', { name: /Drafts/ }));
    expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/products?status=draft', {
      scroll: false,
    });
    await waitFor(() => expect(screen.getByText('Showing 1–6 of 25 products')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true);
    await userEventSession.click(screen.getByRole('button', { name: 'Next' }));
    expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/products?page=2', { scroll: false });
  });

  it('opens the row menu and confirms delete through the dialog', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([product()]));
    const remove = vi.spyOn(productsApi, 'remove').mockResolvedValue(undefined);
    renderProducts(<ProductsListPage />);
    const userEventSession = userEvent.setup();
    const menus = await screen.findAllByRole('button', {
      name: 'More actions for Cotton polo shirt',
    });
    await userEventSession.click(menus[0]!);
    await userEventSession.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/"Cotton polo shirt" will be permanently removed/),
    ).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
    await userEventSession.click(within(dialog).getByRole('button', { name: 'Delete product' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('prod-1'));
  });

  it('publishes/unpublishes from the row menu via the API and shows the rich toast', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([product({ status: 'draft' })]));
    const publish = vi.spyOn(productsApi, 'publish').mockResolvedValue(product());
    renderProducts(<ProductsListPage />);
    const userEventSession = userEvent.setup();
    const menus = await screen.findAllByRole('button', {
      name: 'More actions for Cotton polo shirt',
    });
    await userEventSession.click(menus[0]!);
    await userEventSession.click(screen.getByRole('menuitem', { name: 'Publish' }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith('prod-1'));
    expect(await screen.findByText('Product published')).toBeTruthy();
  });

  it('opens the Product details dialog on View (with thumbnail strip & 2x2 grid) while Edit links to the edit route', async () => {
    const userEventSession = userEvent.setup();
    vi.spyOn(productsApi, 'list').mockResolvedValue(
      page([
        product({
          id: 'prod-ct-001',
          name: 'Classic cotton tee',
          sku: 'SF-CT-001',
          category: 'Tops',
          wholesalePrice: 850000,
          stockQuantity: 0,
          status: 'published',
          images: [],
        }),
      ]),
    );
    renderProducts(<ProductsListPage />);
    await waitFor(() =>
      expect(screen.getAllByText('Classic cotton tee').length).toBeGreaterThan(0),
    );

    const edits = screen.getAllByRole('link', { name: 'Edit' });
    expect(edits[0]?.getAttribute('href')).toBe('/dashboard/products/prod-ct-001/edit');

    const reviewLinks = screen.getAllByRole('link', { name: /Review in inventory/i });
    expect(reviewLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/dashboard/inventory?tab=low-stock',
      '/dashboard/inventory?tab=out-of-stock',
    ]);

    const viewButtons = screen.getAllByRole('button', { name: 'View' });
    const trigger = viewButtons[0]!;
    await userEventSession.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Product details' })).toBeTruthy();
    expect(within(dialog).getByText('Classic cotton tee')).toBeTruthy();
    expect(within(dialog).getByText('SF-CT-001')).toBeTruthy();
    expect(within(dialog).getByText('Tops')).toBeTruthy();
    expect(within(dialog).getByText('₦8,500')).toBeTruthy();
    expect(within(dialog).getByText('Out of stock')).toBeTruthy();
    expect(within(dialog).getByText('Published')).toBeTruthy();

    // Switch placeholder thumbnail and close, verifying focus returns to View trigger.
    const secondThumb = within(dialog).getByRole('button', {
      name: 'Fabric detail placeholder view',
    });
    await userEventSession.click(secondThumb);
    expect(secondThumb.getAttribute('aria-pressed')).toBe('true');

    await userEventSession.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('shows an honest coming-soon state without fake retry when the products endpoint is not implemented', async () => {
    vi.spyOn(productsApi, 'list').mockRejectedValue(
      new ApiError(404, ENDPOINT_NOT_IMPLEMENTED_CODE, 'Not available yet'),
    );
    renderProducts(<ProductsListPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Product catalogue is coming soon' }),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Add product' })).toBeNull();
  });
});
