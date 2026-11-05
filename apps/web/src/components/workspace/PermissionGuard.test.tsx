/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RequireFeature, RequirePermission } from './PermissionGuard';
const mocks = vi.hoisted(() => ({ can: vi.fn(), hasFeature: vi.fn(), status: 'ready', refresh: vi.fn() }));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({ useSession: () => ({ can: mocks.can, hasFeature: mocks.hasFeature, workspaceStatus: mocks.status, workspaceError: null, refreshWorkspace: mocks.refresh }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.status = 'ready'; mocks.can.mockReturnValue(false); mocks.hasFeature.mockReturnValue(false); });
afterEach(() => cleanup());
describe('capability guards', () => {
  it('fails closed without a grant', () => { render(<RequirePermission permission="product:write"><p>Secret form</p></RequirePermission>); expect(screen.queryByText('Secret form')).toBeNull(); expect(screen.getByText('You do not have access')).toBeTruthy(); expect(mocks.can).toHaveBeenCalledWith('product:write'); });
  it('renders with an explicit grant', () => { mocks.can.mockReturnValue(true); render(<RequirePermission permission="pricing:set"><p>Pricing form</p></RequirePermission>); expect(screen.getByText('Pricing form')).toBeTruthy(); });
  it('does not confuse loading with no access', () => { mocks.status = 'loading'; render(<RequireFeature feature="product-catalogue"><p>Products</p></RequireFeature>); expect(screen.getByLabelText('Checking workspace features')).toBeTruthy(); expect(screen.queryByText('Products')).toBeNull(); });
  it('uses feature grants, not role names', () => { mocks.hasFeature.mockReturnValue(true); render(<RequireFeature feature="product-catalogue"><p>Products</p></RequireFeature>); expect(screen.getByText('Products')).toBeTruthy(); expect(mocks.hasFeature).toHaveBeenCalledWith('product-catalogue'); });
});
