import { AuthShell } from '@/components/auth/AuthShell';
import { RegistrationPhoneForm } from '@/components/auth/RegistrationPhoneForm';

export default function PhonePage() {
  return (
    <AuthShell nav={{ label: 'Log in', href: '/auth/login' }}>
      <RegistrationPhoneForm />
    </AuthShell>
  );
}
