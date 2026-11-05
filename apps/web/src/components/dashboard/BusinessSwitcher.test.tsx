/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BusinessSwitcher } from './BusinessSwitcher';
import {
  businessMocks,
  polyfillProductsEnv,
  renderProducts,
  resetProductsMocks,
} from '@/components/products/testSupport';

vi.mock('next/navigation', async () => (await import('@/components/products/testState')).navigationMockFactory());
vi.mock('@/lib/business/BusinessProvider', async () => (await import('@/components/products/testState')).businessMockFactory());

beforeEach(() => {
  resetProductsMocks();
  polyfillProductsEnv();
});
afterEach(() => cleanup());

describe('business switcher', () => {
  it('shows the active business in the pill and opens the menu on click', async () => {
    const userEventSession = userEvent.setup();
    renderProducts(<BusinessSwitcher />);
    const pill = screen.getByRole('button', { name: 'Switch business, current: Okechukwu Fashion' });
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    await userEventSession.click(pill);
    expect(businessMocks.setSwitcherOpen).toHaveBeenCalledWith(true);
  });

  it('lists businesses with type · role and marks the active one', () => {
    businessMocks.switcherOpen = true;
    renderProducts(<BusinessSwitcher />);
    const menu = screen.getByRole('menu', { name: 'Your businesses' });
    const active = within(menu).getByRole('menuitem', { name: /Okechukwu Fashion/ });
    expect(active.getAttribute('aria-current')).toBe('true');
    expect(within(active).getByText('Supplier · Owner')).toBeTruthy();
    const other = within(menu).getByRole('menuitem', { name: /Lagos Fabrics/ });
    expect(other.getAttribute('aria-current')).toBeNull();
    expect(within(other).getByText('Supplier · Admin')).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Add business' })).toBeTruthy();
  });

  it('switches business centrally when another row is selected', async () => {
    const userEventSession = userEvent.setup();
    businessMocks.switcherOpen = true;
    renderProducts(<BusinessSwitcher />);
    await userEventSession.click(screen.getByRole('menuitem', { name: /Lagos Fabrics/ }));
    expect(businessMocks.switchBusiness).toHaveBeenCalledWith('biz-2');
  });

  it('closing via Escape returns focus to the pill', async () => {
    businessMocks.switcherOpen = true;
    renderProducts(<BusinessSwitcher />);
    const menu = screen.getByRole('menu', { name: 'Your businesses' });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(menu.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(businessMocks.setSwitcherOpen).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Switch business, current: Okechukwu Fashion' }));
  });

  it('moves focus with arrow keys', async () => {
    businessMocks.switcherOpen = true;
    renderProducts(<BusinessSwitcher />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const menu = screen.getByRole('menu', { name: 'Your businesses' });
    const items = within(menu).getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);
  });
});
