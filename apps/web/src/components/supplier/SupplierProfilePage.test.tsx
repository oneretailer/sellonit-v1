/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupplierProfilePage } from './SupplierProfilePage';
import { QueryProvider } from '@/lib/providers/QueryProvider';
import { ToastProvider } from '@/components/workspace/ToastProvider';

const mocks = vi.hoisted(() => ({
  canEdit: true,
  activeBusiness: {
    id: 'biz-1',
    name: 'Okechukwu Fashion',
    type: 'SUPPLIER' as const,
    status: 'ACTIVE' as const,
    role: 'OWNER' as const,
    plan: 'ENTERPRISE' as const,
  },
}));

vi.mock('@/lib/business/BusinessProvider', () => ({
  useBusiness: () => ({
    activeBusiness: mocks.activeBusiness,
    can: () => mocks.canEdit,
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mocks.canEdit = true;
});

function renderPage() {
  return render(
    <QueryProvider>
      <ToastProvider>
        <SupplierProfilePage />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe('SupplierProfilePage', () => {
  it('loads the draft supplier profile, saves via PUT, and submits via POST /submit', async () => {
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
                description: 'Initial draft',
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
              description: 'Wholesale textiles',
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

    await user.clear(legalNameInput);
    await user.type(legalNameInput, 'Okechukwu Fashion Ltd');
    await user.type(screen.getByLabelText('City'), 'Lagos');

    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'PUT' && c.url === '/api/v1/supplier/biz-1/profile'),
      ).toBe(true),
    );

    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'POST' && c.url === '/api/v1/supplier/biz-1/profile/submit'),
      ).toBe(true),
    );
    expect(await screen.findByText('PENDING REVIEW')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });

  it('renders a read-only view for STAFF members without edit permissions', async () => {
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
