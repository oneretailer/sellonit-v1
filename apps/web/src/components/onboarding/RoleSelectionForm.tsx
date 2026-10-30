'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { ArrowLeftIcon } from '@/components/reuseable/icons';
import {
  readOnboardingRole,
  subscribeOnboardingRole,
  writeOnboardingRole,
} from '@/lib/auth/flowState';
import { ROLE_OPTIONS, type AccountRole } from '@/lib/onboarding/roles';
import { roleApi } from '@/lib/onboarding/roleApi';

export function RoleSelectionForm() {
  const router = useRouter();
  const selectedRole = useSyncExternalStore(
    subscribeOnboardingRole,
    readOnboardingRole,
    () => null,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function selectRole(role: AccountRole) {
    writeOnboardingRole(role);
    setSaveError(false);
  }

  async function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRole || saving) return;

    const selectedOption = ROLE_OPTIONS.find((option) => option.id === selectedRole);
    if (!selectedOption) return;

    setSaving(true);
    setSaveError(false);
    try {
      const recommendation = await roleApi.saveRole(selectedOption.recommendationKey);
      router.push(recommendation.nextRoute);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="pt-15 w-full flex items-center justify-center">
        <AuthCard gapClassName="gap-6 md:gap-9">
          <AuthCardHeader title="How will you use Sellonit?">
            <span className="mx-auto block max-w-96 text-base text-subtle sm:text-lg">
              Choose the option that best describes your business
            </span>
          </AuthCardHeader>

          <form
            className="flex w-full flex-col gap-6 text-left"
            onSubmit={(event) => {
              void handleContinue(event);
            }}
          >
            <fieldset disabled={saving} className="flex w-full min-w-0 flex-col">
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

            {saveError ? (
              <InlineError className="text-base">
                We couldn&apos;t save your selection. Please try again.
              </InlineError>
            ) : null}

            <div className="flex w-full flex-col items-center gap-6 text-center">
              <PrimaryButton
                type="submit"
                disabled={!selectedRole || saving}
                loading={saving}
                className="auth-button text-ink"
              >
                {saving ? 'Saving…' : 'Continue'}
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
    </>
  );
}
