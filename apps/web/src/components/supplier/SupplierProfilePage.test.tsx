/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupplierProfilePage } from './SupplierProfilePage';
import { QueryProvider } from '@/lib/providers/QueryProvider';
import { ToastProvider } from '@/components/workspace/ToastProvider';
import {
  NavigationGuardProvider,
  useNavigationGuard,
} from '@/components/workspace/NavigationGuard';
import { polyfillDialog } from '@/components/workspace/testUtils';

const mocks = vi.hoisted(() => ({
  canEdit: true,
  push: vi.fn(),
  activeBusiness: {
    id: 'biz-1',
    name: 'Okechukwu Fashion',
    slug: 'okechukwu-fashion',
    email: 'hello@okechukwu.ng',
    phone: '+2348031234567',
    type: 'SUPPLIER' as const,
    status: 'ACTIVE' as const,
    role: 'OWNER',
    plan: 'ENTERPRISE' as const,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/business/BusinessProvider', () => ({
  useBusiness: () => ({
    activeBusiness: mocks.activeBusiness,
    can: (perm: string) => (perm === 'supplier_profile:write' ? mocks.canEdit : true),
  }),
}));

function NavProbeButton() {
  const { navigate } = useNavigationGuard();
  return (
    <button type="button" onClick={() => navigate('/dashboard/products')}>
      Leave page
    </button>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  polyfillDialog();
  mocks.canEdit = true;
  mocks.activeBusiness.role = 'OWNER';
  mocks.push.mockReset();
});

function renderPage() {
  return render(
    <QueryProvider>
      <ToastProvider>
        <NavigationGuardProvider>
          <NavProbeButton />
          <SupplierProfilePage />
        </NavigationGuardProvider>
      </ToastProvider>
    </QueryProvider>,
  );
}

describe('SupplierProfilePage', () => {
  it('defaults unsaved draft retailerAccess to OPEN while pristine, validates with alert + focus, confirms before submitting, and submits via POST /submit', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const urlStr = String(url);
      calls.push({
        url: urlStr,
        method,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      if (method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                businessId: 'biz-1',
                status: 'DRAFT',
                legalName: 'Okechukwu Fashion',
                contactPhone: '08031234567',
                description: 'Wholesale textiles and ready-to-wear garments across Lagos.',
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      if (method === 'PUT') {
        const rawBody = typeof init?.body === 'string' ? init.body : '{}';
        const parsed = JSON.parse(rawBody) as Record<string, unknown>;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                id: 'prof-1',
                businessId: 'biz-1',
                status: 'DRAFT',
                ...parsed,
                updatedAt: '2026-11-05T10:01:00.000Z',
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              id: 'prof-1',
              businessId: 'biz-1',
              status: 'PENDING_REVIEW',
              legalName: 'Okechukwu Fashion Ltd',
              contactPhone: '08031234567',
              description: 'Wholesale textiles and ready-to-wear garments across Lagos.',
              originLocation: {
                recipientName: 'Okechukwu Fashion Ltd',
                phone: '08031234567',
                addressLine1: '12 Marina Road',
                addressLine2: 'Warehouse 4',
                area: 'Lagos Island',
                city: 'Lagos',
                state: 'Lagos',
                country: 'NG',
              },
              submittedAt: '2026-11-05T10:02:00.000Z',
              reviewedAt: null,
              updatedAt: '2026-11-05T10:02:00.000Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    const user = userEvent.setup();
    renderPage();

    const legalNameInput = await screen.findByLabelText<HTMLInputElement>(/Legal business name/);
    expect(legalNameInput.value).toBe('Okechukwu Fashion');
    expect(screen.getByText('DRAFT')).toBeTruthy();

    // Unsaved draft defaults retailerAccess to OPEN while remaining pristine.
    const retailerAccessSelect = screen.getByLabelText<HTMLSelectElement>(/Retailer access/);
    expect(retailerAccessSelect.value).toBe('OPEN');
    expect(screen.getByRole('button', { name: 'Save profile' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Discard changes' }).hasAttribute('disabled')).toBe(
      true,
    );

    // Timestamps hide when null on initial draft.
    expect(screen.queryByText('Submitted')).toBeNull();
    expect(screen.queryByText('Last reviewed')).toBeNull();

    // Right-hand Business account read-only card renders active business metadata + BE-004 note.
    expect(screen.getByText('Business account')).toBeTruthy();
    expect(screen.getByText('Read-only')).toBeTruthy();
    expect(screen.getByText('okechukwu-fashion')).toBeTruthy();
    expect(screen.getByText('Enterprise')).toBeTruthy();
    expect(screen.getByText('hello@okechukwu.ng')).toBeTruthy();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    // Attempting to submit without origin/dispatch address shows alert + focuses first invalid field, without opening ConfirmDialog.
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Profile not submitted — fix 3 fields/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/Street address/));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    // Clicking an item in the alert summary focuses the linked field.
    await user.click(within(alert).getByRole('button', { name: /City: Enter a city\./ }));
    expect(document.activeElement).toBe(screen.getByLabelText(/^City/));

    // Fill complete dispatch details (selecting Lagos from the Nigerian State <select>) and save.
    await user.clear(legalNameInput);
    await user.type(legalNameInput, 'Okechukwu Fashion Ltd');
    await user.type(screen.getByLabelText(/Street address/), '12 Marina Road');
    await user.type(screen.getByLabelText(/Suite, building, or landmark/), 'Warehouse 4');
    await user.type(screen.getByLabelText(/Area \/ LGA/), 'Lagos Island');
    await user.type(screen.getByLabelText(/^City/), 'Lagos');
    await user.selectOptions(screen.getByLabelText(/^State/), 'Lagos');

    // Live error clearing removes the alert once all invalid fields are valid.
    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'PUT' && c.url === '/api/v1/supplier/biz-1/profile'),
      ).toBe(true),
    );
    const putBody = JSON.parse(calls.find((c) => c.method === 'PUT')!.body!) as {
      retailerAccess?: string;
      originLocation?: Record<string, unknown>;
    };
    expect(putBody.retailerAccess).toBe('OPEN');
    expect(putBody.originLocation).toMatchObject({
      addressLine1: '12 Marina Road',
      addressLine2: 'Warehouse 4',
      area: 'Lagos Island',
      city: 'Lagos',
      state: 'Lagos',
      country: 'NG',
    });
    expect(await screen.findByText('Profile saved')).toBeTruthy();

    // Submit opens confirmation dialog first; Cancel aborts without calling POST /submit.
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    const cancelDialog = await screen.findByRole('dialog');
    expect(within(cancelDialog).getByText('Submit profile for review?')).toBeTruthy();
    await user.click(within(cancelDialog).getByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    // Confirming inside the dialog fires POST /submit.
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    const confirmDialog = await screen.findByRole('dialog');
    await user.click(within(confirmDialog).getByRole('button', { name: 'Submit for review' }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'POST' && c.url === '/api/v1/supplier/biz-1/profile/submit'),
      ).toBe(true),
    );
    expect(await screen.findByText('PENDING REVIEW')).toBeTruthy();
    expect(screen.getByText('Submitted for review')).toBeTruthy();
    expect(screen.getByText('Submitted')).toBeTruthy();
    expect(screen.queryByText('Last reviewed')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
  });

  it('tracks dirty state, guards unsaved navigation, clears guard after save, and resets on Discard changes', async () => {
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'PUT') {
        const rawBody = typeof init?.body === 'string' ? init.body : '{}';
        const parsed = JSON.parse(rawBody) as Record<string, unknown>;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                id: 'prof-1',
                businessId: 'biz-1',
                status: 'DRAFT',
                ...parsed,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              id: 'prof-1',
              businessId: 'biz-1',
              status: 'DRAFT',
              legalName: 'Okechukwu Fashion',
              retailerAccess: 'OPEN',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    const user = userEvent.setup();
    renderPage();

    const legalNameInput = await screen.findByLabelText<HTMLInputElement>(/Legal business name/);
    const saveBtn = screen.getByRole('button', { name: 'Save profile' });
    const discardBtn = screen.getByRole('button', { name: 'Discard changes' });

    expect(saveBtn.hasAttribute('disabled')).toBe(true);
    expect(discardBtn.hasAttribute('disabled')).toBe(true);

    // Edit makes form dirty and enables Save/Discard.
    await user.type(legalNameInput, ' Group');
    expect(saveBtn.hasAttribute('disabled')).toBe(false);
    expect(discardBtn.hasAttribute('disabled')).toBe(false);

    // Discard changes resets to baseline and disables Save/Discard.
    await user.click(discardBtn);
    expect(legalNameInput.value).toBe('Okechukwu Fashion');
    expect(saveBtn.hasAttribute('disabled')).toBe(true);
    expect(discardBtn.hasAttribute('disabled')).toBe(true);

    // Edit again and verify NavigationGuard prompts before leaving.
    await user.type(legalNameInput, ' Holdings');
    await user.click(screen.getByRole('button', { name: 'Leave page' }));
    const leaveDialog = await screen.findByRole('dialog');
    expect(within(leaveDialog).getByText('Discard unsaved changes?')).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
    await user.click(within(leaveDialog).getByRole('button', { name: 'Keep editing' }));

    // Save clears dirty state so NavigationGuard allows navigation without prompting.
    await user.click(saveBtn);
    await screen.findByText('Profile saved');
    expect(saveBtn.hasAttribute('disabled')).toBe(true);
    expect(discardBtn.hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Leave page' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.push).toHaveBeenCalledWith('/dashboard/products');
  });

  it('validates fields on blur and switches State between Nigerian states <select> (NG) and free-text <input> (non-NG)', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              businessId: 'biz-1',
              status: 'DRAFT',
              legalName: 'Okechukwu Fashion',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    const phoneInput = await screen.findByLabelText(/Contact phone/);
    await user.type(phoneInput, '123');
    fireEvent.blur(phoneInput);
    expect(await screen.findByText('Enter a valid Nigerian phone number.')).toBeTruthy();
    expect(phoneInput.getAttribute('aria-invalid')).toBe('true');

    // Country defaults to NG and renders a <select> with 36 states + FCT - Abuja.
    const countrySelect = screen.getByLabelText<HTMLSelectElement>(/^Country/);
    expect(countrySelect.value).toBe('NG');
    const ngStateSelect = screen.getByLabelText(/^State/);
    expect(ngStateSelect.tagName).toBe('SELECT');
    expect(within(ngStateSelect).getByRole('option', { name: 'Lagos' })).toBeTruthy();
    expect(within(ngStateSelect).getByRole('option', { name: 'FCT - Abuja' })).toBeTruthy();

    // Switching to Ghana swaps State to a free-text input.
    await user.selectOptions(countrySelect, 'GH');
    const freeStateInput = screen.getByLabelText<HTMLInputElement>(/State \/ region/);
    expect(freeStateInput.tagName).toBe('INPUT');
    await user.type(freeStateInput, 'Greater Accra');
    expect(freeStateInput.value).toBe('Greater Accra');
  });

  it('surfaces a structured error toast when saving fails', async () => {
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'PUT') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: 'VALIDATION_ERROR', message: 'Server rejected origin coordinates.' },
            }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: { businessId: 'biz-1', status: 'DRAFT', legalName: 'Okechukwu Fashion' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    const user = userEvent.setup();
    renderPage();

    const legalNameInput = await screen.findByLabelText(/Legal business name/);
    await user.type(legalNameInput, ' Co');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Could not save profile')).toBeTruthy();
    expect(
      screen.getAllByText('Server rejected origin coordinates.').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('locks resubmission for REJECTED profiles and displays moderation reason and reviewedAt when provided', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              businessId: 'biz-1',
              status: 'REJECTED',
              legalName: 'Okechukwu Fashion',
              rejectionReason: 'CAC registration name did not match dispatch documentation.',
              submittedAt: null,
              reviewedAt: '2026-11-06T14:30:00.000Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    renderPage();
    expect(await screen.findByText('REJECTED')).toBeTruthy();
    expect(screen.getByText(/Resubmission is locked for rejected applications/)).toBeTruthy();
    expect(
      screen.getAllByText(/CAC registration name did not match dispatch documentation\./).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Submitted')).toBeNull();
    expect(screen.getByText('Last reviewed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
  });

  it('allows MANAGER to edit with supplier_profile:write, while rendering STAFF as read-only', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: { businessId: 'biz-1', status: 'DRAFT', legalName: 'Okechukwu Fashion' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    // MANAGER has supplier_profile:write -> editable
    mocks.activeBusiness.role = 'MANAGER';
    mocks.canEdit = true;
    const { unmount } = renderPage();
    expect(await screen.findByRole('button', { name: 'Save profile' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeTruthy();
    unmount();

    // STAFF lacks supplier_profile:write -> read-only
    mocks.activeBusiness.role = 'STAFF';
    mocks.canEdit = false;
    renderPage();
    expect(await screen.findByText(/Only business owners and managers can edit/)).toBeTruthy();
    expect(screen.getByLabelText(/Legal business name/).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard changes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });
});
