/**
 * Rendering helpers for products DOM tests. Mock state/factories live in
 * testState.ts (import-safe for vi.mock factories); this file adds the real
 * QueryClient/Toast/NavigationGuard providers and jsdom polyfills.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { ToastProvider } from '@/components/workspace/ToastProvider';
import { NavigationGuardProvider } from '@/components/workspace/NavigationGuard';
import { polyfillDialog } from '@/components/workspace/testUtils';

export { businessMocks, navMocks, resetProductsMocks } from './testState';

export function polyfillProductsEnv(): void {
  polyfillDialog();
  // jsdom/vitest's createObjectURL cannot handle jsdom Files; stub it outright.
  URL.createObjectURL = (): string => 'blob:preview';
  URL.revokeObjectURL = (): void => undefined;
  Element.prototype.scrollIntoView = (): void => undefined;
}

export function renderProducts(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NavigationGuardProvider>
        <ToastProvider>{ui}</ToastProvider>
      </NavigationGuardProvider>
    </QueryClientProvider>,
  );
}
