import { SignupMethodChooser } from '@/components/auth/SignupMethodChooser';
import { AuthPage } from '@/components/reuseable/AuthPage';

/** Public entry shares the same sign-up chooser shown at /auth/register. */
export default function WelcomePage() {
  return (
    <AuthPage rightLink={{ label: 'Learn more', href: '/learn-more', variant: 'pill' }}>
      <SignupMethodChooser />
    </AuthPage>
  );
}
