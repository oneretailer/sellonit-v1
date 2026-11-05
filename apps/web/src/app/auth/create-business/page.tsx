import type { Metadata } from 'next';
import { RequireAuthenticatedSession } from '@/components/auth/RequireAuthenticatedSession';
import { CreateBusinessForm } from '@/components/onboarding/CreateBusinessForm';
import { AuthPage } from '@/components/reuseable/AuthPage';

export const metadata: Metadata = {
  title: 'Create your business',
  description: 'Set up your business account on Sellonit.',
};

/**
 * The onboarding step immediately after role selection, for every role. The
 * role is already saved at this point, so the guard allows onboarded users
 * (`allowOnboarded`) instead of bouncing them to the dashboard.
 */
export default async function CreateBusinessPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const mode = resolved?.mode === 'add' ? 'add' : 'onboarding';
  return (
    <AuthPage rightLink={{ label: 'Account details', variant: 'text' }}>
      <div className="flex w-full items-center justify-center pt-15 md:pt-0">
        <RequireAuthenticatedSession allowOnboarded>
          <CreateBusinessForm mode={mode} />
        </RequireAuthenticatedSession>
      </div>
    </AuthPage>
  );
}
