import type { ReactNode } from 'react';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthPage } from '@/components/reuseable/AuthPage';
import { PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';

export type NotFoundPageProps = {
  title?: string;
  /** One short explanation under the title. */
  description: ReactNode;
  /** Optional secondary line of copy (e.g. what is available instead). */
  note?: ReactNode;
};

/**
 * The app's custom "not found" screen, shared by `app/not-found.tsx` (unknown
 * URLs) and `app/dashboard/not-found.tsx` (roles whose workspace does not
 * exist yet). Same shell as the auth screens: Navbar + centred AuthCard.
 */
export function NotFoundPage({ title = 'Page not found', description, note }: NotFoundPageProps) {
  return (
    <AuthPage rightLink={{ label: 'Not found', variant: 'text', className: 'text-base' }}>
      <AuthCard gapClassName="gap-6 md:gap-9">
        <AuthCardHeader icon={<BagMark />} title={title}>
          {description}
        </AuthCardHeader>
        {note ? <p className="-mt-2 text-sm leading-6 text-subtle sm:text-base">{note}</p> : null}
        <div className="flex w-full flex-col items-center gap-3">
          <PrimaryLinkButton href="/">Back to home</PrimaryLinkButton>
        </div>
      </AuthCard>
    </AuthPage>
  );
}
