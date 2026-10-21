import { redirect } from 'next/navigation';

/**
 * Legacy registration step URLs (`/auth/register/name`, `/email`, `/password`,
 * `/phone`, `/verify-phone`, `/check-email`) from the old multi-step flow.
 * Legacy form-step URLs now land on the account-details form; `/auth/register` is the new chooser entry.
 */
export default function LegacyRegisterStepPage() {
  redirect('/auth/register/account-details');
}
