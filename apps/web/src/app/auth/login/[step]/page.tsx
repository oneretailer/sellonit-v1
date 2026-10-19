import { redirect } from 'next/navigation';

/**
 * Legacy two-step login URLs (`/auth/login/email`, `/auth/login/password`).
 * Login is now a single screen, so every old step URL lands there.
 */
export default function LegacyLoginStepPage() {
  redirect('/auth/login');
}
