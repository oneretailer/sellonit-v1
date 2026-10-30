import { SignupMethodChooser } from '@/components/auth/SignupMethodChooser';
import { RedirectAuthenticatedUser } from '@/components/auth/RedirectAuthenticatedUser';
import { AuthPage } from '@/components/reuseable/AuthPage';
/** Public entry shares the same sign-up chooser shown at /auth/register. */
export default function WelcomePage() {
  return (
    <RedirectAuthenticatedUser locationKey="/">
      <AuthPage rightLink={{ label: 'Learn more', href: '/learn-more', variant: 'pill' }}>
        <SignupMethodChooser />
      </AuthPage>
    </RedirectAuthenticatedUser>
  );
}
