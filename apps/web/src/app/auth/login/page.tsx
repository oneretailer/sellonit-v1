import { redirect } from 'next/navigation';

/** `/auth/login` has no content of its own; it opens the first login step. */
export default function LoginIndexPage() {
  redirect('/auth/login/email');
}
