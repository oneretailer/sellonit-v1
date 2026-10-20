import type { ReactNode } from 'react';
import { AuthPage } from '@/components/reuseable/AuthPage';

/**
 * Shared shell for the verify-email pages (check-your-email placeholder and
 * the link landing route). TODO: replace with Figma design — plain navbar
 * (logo only) until then.
 */
export default function VerifyEmailLayout({ children }: { children: ReactNode }) {
  return (
    <div className='pt-15 w-full flex items-center justify-center'>
      <AuthPage>{children}</AuthPage>;
    </div>
  )
}
