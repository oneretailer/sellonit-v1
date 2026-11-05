/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductsListPage } from './ProductsListPage';
import {
  navMocks,
  polyfillProductsEnv,
  renderProducts,
  resetProductsMocks,
} from './testSupport';
import { productsApi } from '@/lib/products/productsApi';
import { NetworkError } from '@/lib/api-client';
import type { Paginated, Product, ProductSummary } from '@/lib/products/types';

vi.mock('next/navigation', async () => (await import('./testState')).navigationMockFactory());
vi.mock('@/lib/business/BusinessProvider', async () => (await import('./testState')).businessMockFactory());
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children, ...props }: { href: unknown; children?: React.ReactNode } & Record<string, unknown>) =>
      React.createElement('a', { href: String(href), ...props }, children),
  };
});

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Cotton polo shirt',
    description: '',
    category: 'Tops',
    sku: 'POLO-CTN-001',
    wholesalePrice: 250000,
    stockQuantity: 25,
    status: 'published',
    images: [{ id: 'img-1', url: 'https://cdn.example/polo.jpg' }],
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    ...overrides,
  };
}

function page(rows: Product[], total = rows.length): Paginated<Product> {
  return { data: rows, meta: { page: 1, pageSize: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) } };
}

const summary: ProductSummary = { total: 2, published: 1, drafts: 1, lowStock: 1, outOfStock: 0 };

beforeEach(() => {
  resetProductsMocks();
  polyfillProductsEnv();
  vi.spyOn(productsApi, 'summary').mockResolvedValue(summary);
  vi.spyOn(productsApi, 'getCategories').mockResolvedValue([{ id: 'tops', name: 'Tops' }]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('products list', () => {
  it('renders rows with formatted price, stock and status plus the range footer', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([
      product(),
      product({ id: 'prod-2', name: 'Denim jacket', sku: 'DNM-JKT-002', status: 'draft', stockQuantity: 4, wholesalePrice: 123456 }),
    ], 2));
    renderProducts(<ProductsListPage />);
    await waitFor(() => expect(screen.getAllByText('Cotton polo shirt').length).toBeGreaterThan(0));
    expect(screen.getAllByText('₦2,500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₦1,234.56').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4 left').length).toBeGreaterThan(0);
    expect(screen.getByText('Showing 1–2 of 2 products')).toBeTruthy();
    // Summary stat cards + tab count pills.
    expect(screen.getByText('1 published · 1 drafts')).toBeTruthy();
    const tabs = screen.getByRole('tablist', { name: 'Product status' });
    expect(within(tabs).getByRole('tab', { name: /All/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('shows the true-empty state with an Add product action when there are no products', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([]));
    vi.spyOn(productsApi, 'summary').mockResolvedValue({ total: 0, published: 0, drafts: 0, lowStock: 0, outOfStock: 0 });
    renderProducts(<ProductsListPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'No products yet' })).toBeTruthy());
    expect(screen.getAllByRole('link', { name: 'Add product' }).length).toBeGreaterThan(0);
  });

  it('shows the filter-empty state with Clear filters when filters are active', async () => {
    navMocks.search = 'q=nonexistent';
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([]));
    renderProducts(<ProductsListPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'No products match your filters' })).toBeTruthy());
    const userEventSession = userEvent.setup();
    await userEventSession.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/products', { scroll: false });
  });

  it('shows the error state and retries the list request', async () => {
    const userEventSession = userEvent.setup();
    const list = vi.spyOn(productsApi, 'list')
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValue(page([product()]));
    renderProducts(<ProductsListPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: "We couldn't load your products" })).toBeTruthy());
    await userEventSession.click(screen.getByRole('button', { name: 'Try again' }));
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
    await waitFor(() => expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/products?q=polo', { scroll: false }), { timeout: 2000 });
  });

  it('switches tab and pages through the URL', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([product()], 25));
    renderProducts(<ProductsListPage />);
    const userEventSession = userEvent.setup();
    await userEventSession.click(await screen.findByRole('tab', { name: /Drafts/ }));
    expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/products?status=draft', { scroll: false });
    await waitFor(() => expect(screen.getByText('Showing 1–10 of 25 products')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true);
    await userEventSession.click(screen.getByRole('button', { name: 'Next' }));
    expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/products?page=2', { scroll: false });
  });

  it('opens the row menu and confirms delete through the dialog', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([product()]));
    const remove = vi.spyOn(productsApi, 'remove').mockResolvedValue(undefined);
    renderProducts(<ProductsListPage />);
    const userEventSession = userEvent.setup();
    // jsdom renders both the md+ table and the mobile cards; use the first menu.
    const menus = await screen.findAllByRole('button', { name: 'More actions for Cotton polo shirt' });
    await userEventSession.click(menus[0]!);
    await userEventSession.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/"Cotton polo shirt" will be permanently removed/)).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
    await userEventSession.click(within(dialog).getByRole('button', { name: 'Delete product' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('prod-1'));
  });

  it('publishes/unpublishes from the row menu via the API', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([product({ status: 'draft' })]));
    const publish = vi.spyOn(productsApi, 'publish').mockResolvedValue(product());
    renderProducts(<ProductsListPage />);
    const userEventSession = userEvent.setup();
    const menus = await screen.findAllByRole('button', { name: 'More actions for Cotton polo shirt' });
    await userEventSession.click(menus[0]!);
    await userEventSession.click(screen.getByRole('menuitem', { name: 'Publish' }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith('prod-1'));
  });

  it('View and Edit both link to the edit route', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue(page([product()]));
    renderProducts(<ProductsListPage />);
    await waitFor(() => expect(screen.getAllByText('Cotton polo shirt').length).toBeGreaterThan(0));
    const views = screen.getAllByRole('link', { name: 'View' });
    const edits = screen.getAllByRole('link', { name: 'Edit' });
    expect(views[0]?.getAttribute('href')).toBe('/dashboard/products/prod-1/edit');
    expect(edits[0]?.getAttribute('href')).toBe('/dashboard/products/prod-1/edit');
  });
});
