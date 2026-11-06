import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthSessionProvider } from '@/lib/auth/AuthSessionProvider';
import { readInitialSession } from '@/lib/auth/serverSession';
import { QueryProvider } from '@/lib/providers/QueryProvider';
import { BusinessProvider } from '@/lib/business/BusinessProvider';
import { NavigationGuardProvider } from '@/components/workspace/NavigationGuard';
import { ToastProvider } from '@/components/workspace/ToastProvider';

/**
 * Poppins is exposed as the CSS variable `--font-poppins`. It is set on <html>
 * (not <body>) because `--font-sans` in `@theme` references it, and a `var()`
 * in a custom property resolves on the element that declares it. <body> then
 * uses `font-sans`, which is Poppins everywhere.
 */
export const metadata: Metadata = {
  title: {
    default: 'Sellonit',
    template: '%s — Sellonit',
  },
  description: 'Sellonit — virtual-inventory commerce and supply-chain platform.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const initialSession = await readInitialSession();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <QueryProvider>
          <AuthSessionProvider initialSession={initialSession}>
            <BusinessProvider>
              <NavigationGuardProvider>
                <ToastProvider>{children}</ToastProvider>
              </NavigationGuardProvider>
            </BusinessProvider>
          </AuthSessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
