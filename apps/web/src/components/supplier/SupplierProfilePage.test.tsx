/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupplierProfilePage } from './SupplierProfilePage';
import { QueryProvider } from '@/lib/providers/QueryProvider';
import { ToastProvider } from '@/components/workspace/ToastProvider';
import { NavigationGuardProvider } from '@/components/workspace/NavigationGuard';
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
    role: 'OWNER' as const,
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  polyfillDialog();
  mocks.canEdit = true;
  mocks.push.mockReset();
});

function renderPage() {
  return render(
    <QueryProvider>
      <ToastProvider>
        <NavigationGuardProvider>
          <SupplierProfilePage />
        </NavigationGuardProvider>
      </ToastProvider>
    </QueryProvider>,
  );
}

describe('SupplierProfilePage', () => {
  it('loads the draft profile, blocks incomplete submission with alert + focus, confirms before submitting, saves extended origin fields, and submits via POST /submit', async () => {
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
              updatedAt: '2026-11-05T10:02:00.000Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    const user = userEvent.setup();
    renderPage();

    const legalNameInput = await screen.findByLabelText(/Legal business name/);
    expect((legalNameInput as HTMLInputElement).value).toBe('Okechukwu Fashion');
    expect(screen.getByText('DRAFT')).toBeTruthy();

    // Right-hand Business account summary renders active business metadata.
    expect(screen.getByText('okechukwu-fashion')).toBeTruthy();
    expect(screen.getByText('Enterprise')).toBeTruthy();
    expect(screen.getByText('hello@okechukwu.ng')).toBeTruthy();

    // Attempting to submit without origin/dispatch address shows alert + focuses first invalid field.
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Profile not submitted')).toBeTruthy();
    expect(screen.getByText('Enter a street address (at least 3 characters).')).toBeTruthy();
    expect(screen.getByText('Enter a city.')).toBeTruthy();
    expect(screen.getByText('Enter a state.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/Street address/));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    // Fill complete dispatch details (including addressLine2 and area) and save.
    await user.clear(legalNameInput);
    await user.type(legalNameInput, 'Okechukwu Fashion Ltd');
    await user.type(screen.getByLabelText(/Street address/), '12 Marina Road');
    await user.type(screen.getByLabelText(/Suite, building, or landmark/), 'Warehouse 4');
    await user.type(screen.getByLabelText(/Area \/ LGA/), 'Lagos Island');
    await user.type(screen.getByLabelText(/^City/), 'Lagos');
    await user.type(screen.getByLabelText(/^State/), 'Lagos');

    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'PUT' && c.url === '/api/v1/supplier/biz-1/profile'),
      ).toBe(true),
    );
    const putBody = JSON.parse(calls.find((c) => c.method === 'PUT')!.body!) as {
      originLocation?: Record<string, unknown>;
    };
    expect(putBody.originLocation).toMatchObject({
      addressLine1: '12 Marina Road',
      addressLine2: 'Warehouse 4',
      area: 'Lagos Island',
      city: 'Lagos',
      state: 'Lagos',
      country: 'NG',
    });
    expect(await screen.findByText('Profile saved')).toBeTruthy();

    // Submit opens confirmation dialog first; confirming calls POST /submit.
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Submit profile for review?')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: 'Confirm & submit' }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'POST' && c.url === '/api/v1/supplier/biz-1/profile/submit'),
      ).toBe(true),
    );
    expect(await screen.findByText('PENDING REVIEW')).toBeTruthy();
    expect(screen.getByText('Submitted for review')).toBeTruthy();
    expect(screen.getByText('Submitted')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
  });

  it('tracks dirty state and confirms before discarding unsaved edits', async () => {
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

    const legalNameInput = await screen.findByLabelText(/Legal business name/);
    expect(screen.queryByRole('button', { name: 'Discard changes' })).toBeNull();

    await user.type(legalNameInput, ' Group');
    const discardBtn = screen.getByRole('button', { name: 'Discard changes' });
    await user.click(discardBtn);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Discard unsaved changes?')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    expect((legalNameInput as HTMLInputElement).value).toBe('Okechukwu Fashion');
    expect(screen.queryByRole('button', { name: 'Discard changes' })).toBeNull();
  });

  it('locks resubmission for REJECTED profiles and displays moderation reason when provided', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              businessId: 'biz-1',
              status: 'REJECTED',
              legalName: 'Okechukwu Fashion',
              rejectionReason: 'CAC registration name did not match dispatch documentation.',
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
      screen.getByText(/CAC registration name did not match dispatch documentation\./),
    ).toBeTruthy();
    expect(screen.getByText('Last reviewed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
  });

  it('renders a read-only view for STAFF members without supplier_profile:write permission', async () => {
    mocks.canEdit = false;
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

    renderPage();
    expect(await screen.findByText(/Only business owners and managers can edit/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });
});
