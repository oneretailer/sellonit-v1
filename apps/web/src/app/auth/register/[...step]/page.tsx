import { redirect } from 'next/navigation';

/**
 * Legacy registration step URLs (`/auth/register/name`, `/email`, `/password`,
 * `/phone`, `/verify-phone`, `/check-email`) from the old multi-step flow.
 * Create account is now a single page, so every old step URL lands there.
 */
export default function LegacyRegisterStepPage() {
  redirect('/auth/register');
}
