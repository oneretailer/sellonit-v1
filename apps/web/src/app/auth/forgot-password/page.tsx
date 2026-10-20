import type { Metadata } from 'next';
import { RequestCodeForm } from '@/components/password-reset/RequestCodeForm';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Get a verification code to reset your Sellonit password.',
};

/** Forgot password, step 1: enter an email or phone number to receive a code. */
export default function ForgotPasswordPage() {
  return (
    <>
    <div className='pt-15 w-full flex items-center justify-center'>
      <RequestCodeForm />
    </div>
    </>
  );
}
