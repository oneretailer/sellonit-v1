import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { SIGNUP_COMPLETED_MESSAGE } from '@/lib/auth/useSignupCompletion';
export function SignupCompletionNotice({ error, retry }: { error: string | null; retry: () => void }) {
  return <div className="w-full space-y-3 text-left"><p role="status" aria-live="polite" className="rounded-xl border border-primary/30 bg-orange-50 p-4 text-sm leading-6">{SIGNUP_COMPLETED_MESSAGE}</p>{error ? <><InlineError>{error}</InlineError><PrimaryButton shape="rounded" onClick={retry}>Retry confirmation</PrimaryButton></> : null}</div>;
}
