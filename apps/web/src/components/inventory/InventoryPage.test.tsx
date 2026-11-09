/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  businessMocks,
  navMocks,
  polyfillProductsEnv,
  renderProducts,
  resetProductsMocks,
} from '@/components/products/testSupport';
import { ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE, NetworkError } from '@/lib/api-client';
import { SAMPLE_INVENTORY_ITEMS } from '@/lib/inventory/devMockInventory';
import { inventoryApi } from '@/lib/inventory/inventoryApi';
import type { InventoryItem, InventorySummary, Paginated } from '@/lib/inventory/types';
import { InventoryPage } from './InventoryPage';

vi.mock(
  'next/navigation',
  async () => (await import('@/components/products/testState')).navigationMockFactory(),
);
vi.mock(
  '@/lib/business/BusinessProvider',
  async () => (await import('@/components/products/testState')).businessMockFactory(),
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

function page(rows: readonly InventoryItem[], total = rows.length): Paginated<InventoryItem> {
  return {
    data: [...rows],
    meta: { page: 1, pageSize: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) },
  };
}

const sampleSummary: InventorySummary = {
  total: 124,
  low: 3,
  out: 1,
  inStock: 120,
};

beforeEach(() => {
  resetProductsMocks();
  navMocks.pathname = '/dashboard/inventory';
  polyfillProductsEnv();
  vi.spyOn(inventoryApi, 'summary').mockResolvedValue(sampleSummary);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('InventoryPage & AdjustStockDialog', () => {
  it('renders stat cards, tab counts, sample rows, unavailable "—" reserved cells, footnote, and disabled Import CSV', async () => {
    vi.spyOn(inventoryApi, 'list').mockResolvedValue(page(SAMPLE_INVENTORY_ITEMS, 124));
    renderProducts(<InventoryPage />);

    await waitFor(() => expect(screen.getAllByText('Linen shirt').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Classic cotton tee').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wide-brim hat').length).toBeGreaterThan(0);

    // Tab labels include counts (including In stock).
    const tabNav = screen.getByRole('navigation', { name: 'Inventory stock status' });
    expect(
      within(tabNav).getByRole('button', { name: 'All products · 124' }).getAttribute('aria-current'),
    ).toBe('true');
    expect(within(tabNav).getByRole('button', { name: 'Low stock · 3' })).toBeTruthy();
    expect(within(tabNav).getByRole('button', { name: 'Out of stock · 1' })).toBeTruthy();
    expect(within(tabNav).getByRole('button', { name: 'In stock · 120' })).toBeTruthy();

    // Stat cards have no links on Inventory.
    expect(screen.queryByRole('link', { name: /Review in inventory/i })).toBeNull();

    // Import CSV is disabled with the coming-soon tooltip.
    const importBtn = screen.getByRole('button', { name: /Import CSV/i });
    expect(importBtn.hasAttribute('disabled')).toBe(true);
    expect(importBtn.getAttribute('title')).toBe('CSV import is coming soon');

    // Reserved cells render "—" (unavailable) when reservedQuantity is null, plus footnote.
    expect(screen.getAllByLabelText('Unavailable').length).toBe(SAMPLE_INVENTORY_ITEMS.length);
    expect(
      screen.getByText(
        /Reserved quantity is unavailable here, not zero\. Reserved stock is system-managed and cannot be edited\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Showing 1–6 of 124 products')).toBeTruthy();
  });

  it('displays numeric reserved stock only when the backend returns a real number', async () => {
    const withReserved: InventoryItem = {
      ...SAMPLE_INVENTORY_ITEMS[1]!,
      reservedQuantity: 4,
    };
    vi.spyOn(inventoryApi, 'list').mockResolvedValue(page([withReserved], 1));
    renderProducts(<InventoryPage />);

    await waitFor(() => expect(screen.getAllByText('Linen shirt').length).toBeGreaterThan(0));
    expect(screen.queryByLabelText('Unavailable')).toBeNull();
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
  });

  it('syncs tab, debounced search, and pagination into URL query params and resets page on filter change', async () => {
    navMocks.search = 'page=2';
    vi.spyOn(inventoryApi, 'list').mockResolvedValue(page(SAMPLE_INVENTORY_ITEMS, 124));
    renderProducts(<InventoryPage />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Low stock · 3' }));
    expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/inventory?tab=low-stock', {
      scroll: false,
    });

    navMocks.replace.mockClear();
    const search = screen.getByRole('searchbox', { name: 'Search by product name or SKU' });
    await user.type(search, 'SF-LS');
    expect(navMocks.replace).not.toHaveBeenCalled();
    await waitFor(
      () =>
        expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/inventory?q=SF-LS', {
          scroll: false,
        }),
      { timeout: 2000 },
    );
  });

  it('renders true-empty, search-empty, network-error retry, and ENDPOINT_NOT_IMPLEMENTED states', async () => {
    const user = userEvent.setup();

    // 1. True empty
    vi.spyOn(inventoryApi, 'list').mockResolvedValueOnce(page([], 0));
    vi.spyOn(inventoryApi, 'summary').mockResolvedValueOnce({
      total: 0,
      low: 0,
      out: 0,
      inStock: 0,
    });
    const first = renderProducts(<InventoryPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'No products to track yet' })).toBeTruthy(),
    );
    expect(screen.getByRole('link', { name: 'Add product' }).getAttribute('href')).toBe(
      '/dashboard/products/new',
    );
    first.unmount();

    // 2. Search/tab empty
    navMocks.search = 'q=unknown';
    vi.spyOn(inventoryApi, 'list').mockResolvedValueOnce(page([], 0));
    const second = renderProducts(<InventoryPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'No products match your search' })).toBeTruthy(),
    );
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(navMocks.replace).toHaveBeenCalledWith('/dashboard/inventory', { scroll: false });
    second.unmount();

    // 3. Network error + Try again
    navMocks.search = '';
    const retryList = vi.spyOn(inventoryApi, 'list');
    retryList.mockReset();
    retryList
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce(page(SAMPLE_INVENTORY_ITEMS, 6));
    const third = renderProducts(<InventoryPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: "We couldn't load your inventory" })).toBeTruthy(),
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getAllByText('Linen shirt').length).toBeGreaterThan(0));
    expect(retryList).toHaveBeenCalledTimes(2);
    third.unmount();

    // 4. Unimplemented endpoint -> honest coming soon without fake retry
    vi.spyOn(inventoryApi, 'list').mockRejectedValueOnce(
      new ApiError(404, ENDPOINT_NOT_IMPLEMENTED_CODE, 'Not implemented'),
    );
    renderProducts(<InventoryPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Inventory management is coming soon' }),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('hides Adjust stock when can("inventory:write") is false', async () => {
    businessMocks.can.mockImplementation((permission: string) => permission === 'inventory:read');
    vi.spyOn(inventoryApi, 'list').mockResolvedValue(page(SAMPLE_INVENTORY_ITEMS, 6));
    renderProducts(<InventoryPage />);

    await waitFor(() => expect(screen.getAllByText('Linen shirt').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /Adjust stock/i })).toBeNull();
  });

  it('validates on blur, supports arrow-key radio switching, submits a delta adjustment, and restores focus on close', async () => {
    const user = userEvent.setup();
    vi.spyOn(inventoryApi, 'list').mockResolvedValue(page(SAMPLE_INVENTORY_ITEMS, 6));
    const adjustSpy = vi.spyOn(inventoryApi, 'adjustStock').mockResolvedValue({
      ...SAMPLE_INVENTORY_ITEMS[1]!,
      availableQuantity: 15,
      stockStatus: 'in-stock',
    });

    renderProducts(<InventoryPage />);
    const triggers = await screen.findAllByRole('button', {
      name: 'Adjust stock for Linen shirt',
    });
    const trigger = triggers[0]!;
    await user.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Adjust stock' })).toBeTruthy();
    expect(within(dialog).getByText('— Unavailable')).toBeTruthy();
    expect(within(dialog).getByText('Proposed change: —')).toBeTruthy();

    // Primary button starts disabled with Increase label.
    const submitBtn = within(dialog).getByRole('button', { name: 'Increase stock' });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    // Blur empty quantity -> shows numeric error.
    const qtyInput = within(dialog).getByLabelText(/Quantity/);
    await user.click(qtyInput);
    await user.tab();
    expect(within(dialog).getByText('Enter a numeric quantity.')).toBeTruthy();

    // Switch to Decrease via arrow key and test decrease cap against current stock (3).
    const increaseRadio = within(dialog).getByRole('radio', { name: 'Increase' });
    increaseRadio.focus();
    await user.keyboard('{ArrowRight}');
    const decreaseRadio = within(dialog).getByRole('radio', { name: 'Decrease' });
    expect((decreaseRadio as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).getByRole('button', { name: 'Decrease stock' })).toBeTruthy();

    await user.type(qtyInput, '4');
    expect(
      within(dialog).getByText("You can't remove more than the available stock (3)."),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Decrease stock' }).hasAttribute('disabled'),
    ).toBe(true);

    // Switch back to Increase and enter 12 -> live preview updates and submit succeeds.
    await user.click(increaseRadio);
    await user.clear(qtyInput);
    await user.type(qtyInput, '12');
    expect(within(dialog).getByText('Proposed change: +12 units')).toBeTruthy();
    expect(
      within(dialog).getByText(
        'Increase stock for Linen shirt by 12 units. Availability refreshes after the update.',
      ),
    ).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Increase stock' }));
    await waitFor(() => expect(adjustSpy).toHaveBeenCalledTimes(1));
    expect(adjustSpy.mock.calls[0]?.[0]).toBe('inv-ls-014');
    expect(adjustSpy.mock.calls[0]?.[1]).toEqual({ direction: 'increase', quantity: 12 });
    expect(adjustSpy.mock.calls[0]?.[2]?.signal).toBeInstanceOf(AbortSignal);
    await waitFor(() => expect(screen.getByText('Stock updated')).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the dialog open on 409 conflict, refreshes current stock, and asks the user to review', async () => {
    const user = userEvent.setup();
    vi.spyOn(inventoryApi, 'list')
      .mockResolvedValueOnce(page(SAMPLE_INVENTORY_ITEMS, 6))
      .mockResolvedValueOnce(
        page(
          SAMPLE_INVENTORY_ITEMS.map((row) =>
            row.productId === 'inv-ls-014' ? { ...row, availableQuantity: 1 } : row,
          ),
          6,
        ),
      );
    vi.spyOn(inventoryApi, 'adjustStock').mockRejectedValueOnce(
      new ApiError(409, 'INVENTORY_CONFLICT', 'Stock changed concurrently'),
    );

    renderProducts(<InventoryPage />);
    const triggers = await screen.findAllByRole('button', {
      name: 'Adjust stock for Linen shirt',
    });
    await user.click(triggers[0]!);

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Decrease' }));
    await user.type(within(dialog).getByLabelText(/Quantity/), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Decrease stock' }));

    await waitFor(() =>
      expect(
        within(dialog).getByText(
          'Available stock changed to 1 while you were editing. Review your adjustment and try again.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
