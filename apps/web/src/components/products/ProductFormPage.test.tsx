/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductFormPage } from './ProductFormPage';
import { navMocks, polyfillProductsEnv, renderProducts, resetProductsMocks } from './testSupport';
import {
  FULL_CATALOGUE_CAPABILITIES,
  LIVE_CATALOGUE_CAPABILITIES,
  productsApi,
} from '@/lib/products/productsApi';
import { ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE } from '@/lib/api-client';
import type { Product } from '@/lib/products/types';

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

function savedProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Cotton polo shirt',
    description: '',
    category: 'tops',
    sku: 'SF-PS-022',
    wholesalePrice: 750000,
    stockQuantity: 60,
    status: 'draft',
    images: [],
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetProductsMocks();
  polyfillProductsEnv();
  navMocks.pathname = '/dashboard/products/new';
  vi.spyOn(productsApi, 'getCapabilities').mockReturnValue(FULL_CATALOGUE_CAPABILITIES);
  vi.spyOn(productsApi, 'getCategories').mockResolvedValue([{ id: 'tops', name: 'Tops' }]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function fillRequired(userEventSession: ReturnType<typeof userEvent.setup>) {
  await userEventSession.type(screen.getByLabelText(/Product name/), 'Cotton polo shirt');
  await userEventSession.selectOptions(screen.getByLabelText(/Category/), 'tops');
  await userEventSession.type(screen.getByLabelText(/^SKU/), 'SF-PS-022');
  await userEventSession.type(screen.getByLabelText(/Wholesale price/), '7500');
  await userEventSession.type(screen.getByLabelText(/Stock quantity/), '60');
}

describe('add product form', () => {
  it('updates the sticky Preview card live as fields are typed', async () => {
    const userEventSession = userEvent.setup();
    renderProducts(<ProductFormPage />);

    // Empty preview defaults
    expect(screen.getByText('No photo yet')).toBeTruthy();
    expect(screen.getByText('₦ –')).toBeTruthy();
    expect(screen.getByText('– in stock')).toBeTruthy();
    expect(screen.getByText('Category · SKU')).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();

    await fillRequired(userEventSession);
    expect(screen.getByText('Tops · SF-PS-022')).toBeTruthy();
    expect(screen.getByText('₦7,500')).toBeTruthy();
    expect(screen.getByText('60 in stock')).toBeTruthy();
  });

  it('blocks publish with the alert, exact field errors and focus on the first invalid field', async () => {
    const userEventSession = userEvent.setup();
    const create = vi.spyOn(productsApi, 'create');
    renderProducts(<ProductFormPage />);
    await userEventSession.click(screen.getByRole('button', { name: 'Publish product' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Product not published')).toBeTruthy();
    expect(within(alert).getByText('Fix the 6 highlighted fields and try again.')).toBeTruthy();
    expect(screen.getByText('Add at least one photo.')).toBeTruthy();
    expect(screen.getByText('Enter a product name.')).toBeTruthy();
    expect(screen.getByText('Choose a category.')).toBeTruthy();
    expect(screen.getByText('Enter a SKU.')).toBeTruthy();
    expect(screen.getByText('Enter a wholesale price.')).toBeTruthy();
    expect(screen.getByText('Enter the stock quantity.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById('product-photos'));
    // Alert is dismissible.
    await userEventSession.click(screen.getByRole('button', { name: 'Dismiss alert' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('errors clear as fields become valid after a failed attempt', async () => {
    const userEventSession = userEvent.setup();
    vi.spyOn(productsApi, 'create').mockResolvedValue(savedProduct());
    renderProducts(<ProductFormPage />);
    await userEventSession.click(screen.getByRole('button', { name: 'Publish product' }));
    await screen.findByText('Enter a product name.');
    await userEventSession.type(screen.getByLabelText(/Product name/), 'Cotton polo shirt');
    await waitFor(() => expect(screen.queryByText('Enter a product name.')).toBeNull());
    expect(screen.getByText('Fix the 5 highlighted fields and try again.')).toBeTruthy();
  });

  it('saves a partial draft (even without name), shows the Draft saved toast, and redirects', async () => {
    const userEventSession = userEvent.setup();
    const create = vi
      .spyOn(productsApi, 'create')
      .mockResolvedValue(savedProduct({ name: 'Untitled product' }));
    renderProducts(<ProductFormPage />);
    await userEventSession.type(screen.getByLabelText(/^SKU/), 'SF-PS-022');
    await userEventSession.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Untitled product',
          sku: 'SF-PS-022',
          wholesalePrice: 0,
          stockQuantity: 0,
          imageIds: [],
        }),
      ),
    );
    await waitFor(() => expect(navMocks.push).toHaveBeenCalledWith('/dashboard/products'));
    expect(await screen.findByText('Draft saved')).toBeTruthy();
    expect(screen.getByText('Untitled product is saved as a draft.')).toBeTruthy();
  });

  it('asks to confirm publish, then creates + publishes and shows the success dialog', async () => {
    const userEventSession = userEvent.setup();
    const create = vi.spyOn(productsApi, 'create').mockResolvedValue(savedProduct());
    const publish = vi
      .spyOn(productsApi, 'publish')
      .mockResolvedValue(savedProduct({ status: 'published' }));
    vi.spyOn(productsApi, 'uploadImage').mockResolvedValue({
      id: 'img-1',
      url: 'https://cdn.example/polo.jpg',
    });
    renderProducts(<ProductFormPage />);
    await fillRequired(userEventSession);
    const file = new File(['photo'], 'polo.png', { type: 'image/png' });
    await userEventSession.upload(screen.getByLabelText('Upload product photos'), file);
    await waitFor(() => expect(screen.getByText('Main photo')).toBeTruthy());
    await userEventSession.click(screen.getByRole('button', { name: 'Publish product' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Confirm publish')).toBeTruthy();
    expect(
      within(dialog).getByText(/"Cotton polo shirt" will be visible to retailers/),
    ).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
    // Initial focus is the safe Cancel action.
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    await userEventSession.click(within(dialog).getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cotton polo shirt',
          wholesalePrice: 750000,
          stockQuantity: 60,
          imageIds: ['img-1'],
        }),
      ),
    );
    await waitFor(() => expect(publish).toHaveBeenCalledWith('prod-1'));
    const success = await screen.findByRole('dialog');
    expect(within(success).getByRole('heading', { name: 'Product published' })).toBeTruthy();
    await userEventSession.click(within(success).getByRole('button', { name: 'Back to products' }));
    expect(navMocks.push).toHaveBeenCalledWith('/dashboard/products');
  });

  it('maps a duplicate-SKU server error onto the SKU field', async () => {
    const userEventSession = userEvent.setup();
    vi.spyOn(productsApi, 'create').mockRejectedValue(
      new ApiError(409, 'SKU_CONFLICT', 'Conflict', null, {
        sku: 'A product with this SKU already exists.',
      }),
    );
    renderProducts(<ProductFormPage />);
    await userEventSession.type(screen.getByLabelText(/Product name/), 'Cotton polo shirt');
    await userEventSession.type(screen.getByLabelText(/^SKU/), 'SF-PS-022');
    await userEventSession.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(screen.getAllByText('A product with this SKU already exists.').length).toBeGreaterThan(
        0,
      ),
    );
    const sku = screen.getByLabelText(/^SKU/);
    expect(sku.getAttribute('aria-invalid')).toBe('true');
  });

  it('confirms before leaving a dirty form via Cancel and stays when keeping edits', async () => {
    const userEventSession = userEvent.setup();
    vi.spyOn(productsApi, 'create').mockResolvedValue(savedProduct());
    renderProducts(<ProductFormPage />);
    await userEventSession.type(screen.getByLabelText(/Product name/), 'Unsaved shirt');
    await userEventSession.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Discard this product?')).toBeTruthy();
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: 'Keep editing' }),
    );
    await userEventSession.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(navMocks.push).not.toHaveBeenCalled();
    await userEventSession.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEventSession.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard' }),
    );
    await waitFor(() => expect(navMocks.push).toHaveBeenCalledWith('/dashboard/products'));
  });

  it('leaves a pristine form without a confirmation', async () => {
    const userEventSession = userEvent.setup();
    renderProducts(<ProductFormPage />);
    await userEventSession.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(navMocks.push).toHaveBeenCalledWith('/dashboard/products');
  });

  it('distinguishes unimplemented product endpoints from a deleted 404 product on edit', async () => {
    vi.spyOn(productsApi, 'get').mockRejectedValueOnce(
      new ApiError(404, ENDPOINT_NOT_IMPLEMENTED_CODE, 'Not implemented'),
    );
    const { unmount } = renderProducts(<ProductFormPage productId="prod-1" />);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Product catalogue is coming soon' }),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole('heading', { name: 'Product not found' })).toBeNull();
    unmount();

    vi.spyOn(productsApi, 'get').mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'Deleted'));
    renderProducts(<ProductFormPage productId="prod-1" />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Product not found' })).toBeTruthy(),
    );
  });

  it('disables saving with an honest notice on /new when categories return ENDPOINT_NOT_IMPLEMENTED', async () => {
    vi.spyOn(productsApi, 'getCategories').mockRejectedValue(
      new ApiError(404, ENDPOINT_NOT_IMPLEMENTED_CODE, 'Not implemented'),
    );
    renderProducts(<ProductFormPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/Product catalogue endpoints are not available on the server yet/),
      ).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: 'Publish product' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Save draft' })).toHaveProperty('disabled', true);
  });
});

describe('product form (PR #18 strict live contract)', () => {
  beforeEach(() => {
    vi.spyOn(productsApi, 'getCapabilities').mockReturnValue(LIVE_CATALOGUE_CAPABILITIES);
  });

  it('uses text Category input without calling /categories, disables stock & photos, requires SKU+price on draft, and publishes without photos', async () => {
    const userEventSession = userEvent.setup();
    const categoriesSpy = vi.spyOn(productsApi, 'getCategories');
    const create = vi
      .spyOn(productsApi, 'create')
      .mockResolvedValue(savedProduct({ stockQuantity: null, category: 'Tops' }));
    const publish = vi
      .spyOn(productsApi, 'publish')
      .mockResolvedValue(savedProduct({ status: 'published', stockQuantity: null }));

    renderProducts(<ProductFormPage />);
    expect(categoriesSpy).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Stock quantity/)).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Upload product photos')).toHaveProperty('disabled', true);

    // Draft requires SKU and positive price on PR #18.
    await userEventSession.type(screen.getByLabelText(/Product name/), 'Cotton polo shirt');
    await userEventSession.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByText('Enter a SKU.')).toBeTruthy();
    expect(screen.getByText('Enter a wholesale price.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();

    // Fill category text, SKU, and price, then publish without photos/stock.
    await userEventSession.type(screen.getByLabelText(/Category/), 'Tops');
    await userEventSession.type(screen.getByLabelText(/^SKU/), 'SF-PS-022');
    await userEventSession.type(screen.getByLabelText(/Wholesale price/), '7500');
    await userEventSession.click(screen.getByRole('button', { name: 'Publish product' }));
    const confirmDialog = await screen.findByRole('dialog');
    await userEventSession.click(within(confirmDialog).getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cotton polo shirt',
          category: 'Tops',
          sku: 'SF-PS-022',
          wholesalePrice: 750000,
        }),
      ),
    );
    await waitFor(() => expect(publish).toHaveBeenCalledWith('prod-1'));
  });

  it('preserves saved draft state and surfaces actionable alert when publish fails with SUPPLIER_NOT_APPROVED', async () => {
    const userEventSession = userEvent.setup();
    vi.spyOn(productsApi, 'create').mockResolvedValue(savedProduct({ stockQuantity: null }));
    vi.spyOn(productsApi, 'publish').mockRejectedValue(
      new ApiError(
        403,
        'SUPPLIER_NOT_APPROVED',
        'Your supplier account must be approved before publishing.',
      ),
    );

    renderProducts(<ProductFormPage />);
    await userEventSession.type(screen.getByLabelText(/Product name/), 'Cotton polo shirt');
    await userEventSession.type(screen.getByLabelText(/Category/), 'Tops');
    await userEventSession.type(screen.getByLabelText(/^SKU/), 'SF-PS-022');
    await userEventSession.type(screen.getByLabelText(/Wholesale price/), '7500');
    await userEventSession.click(screen.getByRole('button', { name: 'Publish product' }));
    const confirmDialog = await screen.findByRole('dialog');
    await userEventSession.click(within(confirmDialog).getByRole('button', { name: 'Publish' }));

    expect(
      await screen.findByText(
        /Saved as a draft, but could not publish: Your supplier account must be approved before publishing\./,
      ),
    ).toBeTruthy();
  });

  it('renders archived products as read-only and disables editing', async () => {
    vi.spyOn(productsApi, 'get').mockResolvedValue(
      savedProduct({ status: 'archived', stockQuantity: null }),
    );
    renderProducts(<ProductFormPage productId="prod-1" />);
    expect(
      await screen.findByText('This product is archived and can no longer be edited.'),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Product name/)).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveProperty('disabled', true);
  });
});
