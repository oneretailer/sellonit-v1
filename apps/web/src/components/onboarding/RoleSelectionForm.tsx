'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { RoleRecommendation } from '@/components/onboarding/RoleRecommendation';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { ArrowLeftIcon } from '@/components/reuseable/icons';
import {
  readOnboardingRole,
  subscribeOnboardingRole,
  writeOnboardingRole,
} from '@/lib/auth/flowState';
import { ROLE_OPTIONS, type AccountRole } from '@/lib/onboarding/roles';

/**
 * "How will you use Sellonit?" and its recommendation view.
 *
 * The two views share one route and one AuthCard: picking a role only switches
 * the view (the choice is kept in flow state so Go Back restores it), and the
 * role is saved only when the user presses "Continue as X" on the
 * recommendation view.
 */
export function RoleSelectionForm() {
  const selectedRole = useSyncExternalStore(
    subscribeOnboardingRole,
    readOnboardingRole,
    () => null,
  );
  const [view, setView] = useState<'select' | 'recommend'>('select');
  const formRef = useRef<HTMLFormElement>(null);

  // Returning from the recommendation view restores focus to the chosen option
  // instead of dropping focus on <body>.
  useEffect(() => {
    if (view !== 'select' || !selectedRole) return;
    const input = formRef.current?.querySelector<HTMLInputElement>('input:checked');
    input?.focus({ preventScroll: true });
    // Only on the transition back to the selection view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function selectRole(role: AccountRole) {
    writeOnboardingRole(role);
  }

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRole) return;
    setView('recommend');
  }

  if (view === 'recommend' && selectedRole) {
    return (
      <AuthCard gapClassName="gap-8 md:gap-12">
        <RoleRecommendation role={selectedRole} onBack={() => setView('select')} />
      </AuthCard>
    );
  }

  return (
    <div className="flex w-full items-center justify-center pt-15">
      <AuthCard gapClassName="gap-6 md:gap-9">
        <AuthCardHeader title="How will you use Sellonit?">
          <span className="mx-auto block max-w-96 text-base text-subtle sm:text-lg">
            Choose the option that best describes your business
          </span>
        </AuthCardHeader>

        <form
          ref={formRef}
          className="flex w-full flex-col gap-6 text-left"
          onSubmit={handleContinue}
        >
          <fieldset className="flex w-full min-w-0 flex-col">
            <legend className="mb-4 text-base font-semibold text-ink">Account role</legend>
            <div className="flex w-full flex-col gap-4">
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className="flex min-h-16 w-full min-w-0 cursor-pointer items-center gap-4 rounded-xl border border-line bg-white p-5 text-left has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
                >
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="account-role"
                    value={option.id}
                    checked={selectedRole === option.id}
                    onChange={() => selectRole(option.id)}
                  />
                  <span
                    aria-hidden="true"
                    className="relative size-6 shrink-0 rounded-full border border-subtle bg-white after:absolute after:inset-1 after:rounded-full after:bg-primary after:opacity-0 after:content-[''] peer-checked:border-primary peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2"
                  />
                  <span className="min-w-0 flex-1 text-base text-ink">{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex w-full flex-col items-center gap-6 text-center">
            <PrimaryButton type="submit" disabled={!selectedRole} className="auth-button text-ink">
              Continue
            </PrimaryButton>
            <Link
              href="/auth/welcome"
              className="inline-flex min-h-11 items-center justify-center gap-2 px-4 text-base font-medium text-ink"
            >
              <ArrowLeftIcon />
              Back
            </Link>
          </div>
        </form>
      </AuthCard>
    </div>
  );
}
