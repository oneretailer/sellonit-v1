import Link from 'next/link';
import type { Route } from 'next';

export type AuthSwitchPromptProps = {
  question: string;
  label: string;
  href: Route;
};

/** Footer line that switches between login and registration, e.g. "Already have an account? Log in". */
export function AuthSwitchPrompt({ question, label, href }: AuthSwitchPromptProps) {
  return (
    <p className="text-center text-sm text-subtle">
      {question}{' '}
      <Link href={href} className="font-semibold text-subtle underline underline-offset-2">
        {label}
      </Link>
    </p>
  );
}
