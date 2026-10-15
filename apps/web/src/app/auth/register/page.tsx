import { redirect } from 'next/navigation';
import { REGISTER_STEPS } from '@/components/register/registerSteps';

/** `/auth/register` has no content of its own; it opens the first step. */
export default function RegisterIndexPage() {
  redirect(REGISTER_STEPS[0].path);
}
