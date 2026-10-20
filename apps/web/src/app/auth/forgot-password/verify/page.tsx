import type { Metadata } from 'next';
import { CodeForm } from '@/components/password-reset/CodeForm';

export const metadata: Metadata = {
  title: 'Enter verification code',
};

/** Forgot password, step 2: enter the six-digit code. */
export default function ForgotPasswordVerifyPage() {
  return(
    <div className='pt-15 w-full flex items-center justify-center'>
       <CodeForm purpose="reset-password" />
    </div>
  );
}
