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
export default function CreateBusinessPage() {
  return (
    <AuthPage rightLink={{ label: 'Account details', variant: 'text' }}>
      <div className="flex w-full items-center justify-center pt-15 md:pt-0">
        <RequireAuthenticatedSession allowOnboarded>
          <CreateBusinessForm />
        </RequireAuthenticatedSession>
      </div>
    </AuthPage>
  );
}
