import type { Metadata } from 'next';
import { SignupMethodChooser } from '@/components/auth/SignupMethodChooser';

export const metadata: Metadata = {
  title: 'Create your Sellonit account',
  description: 'Choose how you would like to get started with Sellonit.',
};

/** Sign-up entry: choose a provider or continue to the existing email form. */
export default function SignupEntryPage() {
  return <SignupMethodChooser />;
}
