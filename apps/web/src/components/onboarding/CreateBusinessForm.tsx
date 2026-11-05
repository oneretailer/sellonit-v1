'use client';

import { useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import {
  readOnboardingRole,
  subscribeOnboardingRole,
} from '@/lib/auth/flowState';
import { normalizePhone } from '@/lib/auth/identifier';
import { businessApi, canCreateBusiness } from '@/lib/onboarding/businessApi';
import { roleForBusinessType } from '@/lib/onboarding/roleApi';
import type { AccountRole } from '@/lib/onboarding/roles';
import { cn } from '@/lib/cn';
import { isValidEmail, normalizeEmail } from '@/lib/validation/auth';
import { useSignupCompletion } from '@/lib/auth/useSignupCompletion';
import { SignupCompletionNotice } from '@/components/auth/SignupCompletionNotice';
import { newIdempotencyKey } from '@/lib/api';
import { presentError } from '@/lib/workspace/errors';

const COMING_SOON_MESSAGE =
  'Business creation for your role is coming soon. Your details stay in this form until your workspace is ready.';
const JOIN_COMING_SOON_MESSAGE =
  'Joining an existing business is coming soon. For now you can create your own business above.';

/* md+ only: round the bordered field wrappers to ~16px to match the login card.
   The wrapper (not the inner input) carries the border, so target div:has(>input). */
const businessFieldWrapperClass =
  'md:[&_div:has(>input:not([type=checkbox]))]:rounded-2xl';

type FieldKey = 'name' | 'phone' | 'email';

function nameError(value: string): string | null {
  return value.trim().length >= 2 ? null : 'Enter your business name.';
}
function phoneError(value: string): string | null {
  return normalizePhone(value) !== null ? null : 'Invalid phone number';
}
function emailError(value: string): string | null {
  return isValidEmail(value) ? null : 'Invalid email';
}

/**
 * "Create your business" — the onboarding step immediately after role selection,
 * shown for every role. Supplier submits and advances to the dashboard; other
 * roles validate the same form but get a friendly non-blocking "coming soon"
 * notice (gated by canCreateBusiness) without submitting. Supplier details are
 * persisted through the typed business API; a local draft is written only after
 * server success for setup progress. Errors show on blur or submit, never on
 * each keystroke.
 */
export function CreateBusinessForm() {
  const { user, refreshWorkspace } = useAuthSession();
  const completion = useSignupCompletion();
  const storedRole = useSyncExternalStore(
    subscribeOnboardingRole,
    readOnboardingRole,
    () => null,
  );
  // The saved account intent wins; fall back to this browser's selection.
  const role: AccountRole | null = user?.onboardingIntent
    ? roleForBusinessType(user.onboardingIntent)
    : storedRole;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string | null>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const idempotencyKey = useRef<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Graceful name fallback: show the backend first name once synced, otherwise
  // render nothing (never an empty-string greeting).
  const firstName = user?.firstName?.trim().split(/\s+/)[0] ?? '';

  const valid =
    nameError(name) === null && phoneError(phone) === null && emailError(email) === null;

  function clearFieldError(field: FieldKey) {
    setErrors((current) => ({ ...current, [field]: null }));
    setNotice(null);
    setFormError(null);
  }

  function handleBlur(field: FieldKey, value: string) {
    const message =
      field === 'name' ? nameError(value) : field === 'phone' ? phoneError(value) : emailError(value);
    setErrors((current) => ({ ...current, [field]: message }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || completion.locked) return;

    const nextErrors: Record<FieldKey, string | null> = {
      name: nameError(name),
      phone: phoneError(phone),
      email: emailError(email),
    };
    setErrors(nextErrors);
    setNotice(null);
    setFormError(null);
    if (nextErrors.name || nextErrors.phone || nextErrors.email) {
      // Focus the first invalid field (errors are already shown above).
      if (nextErrors.name) nameRef.current?.focus();
      else if (nextErrors.phone) phoneRef.current?.focus();
      else emailRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      // Actual server membership, not onboardingIntent or the local draft, is completion.
      if (await completion.confirmOnServer()) return;
      const confirmationError = completion.getConfirmationError();
      if (confirmationError) { setFormError(confirmationError); inFlight.current = false; setSubmitting(false); return; }
      if (!canCreateBusiness(role)) {
        setNotice(COMING_SOON_MESSAGE); inFlight.current = false; setSubmitting(false); return;
      }
      idempotencyKey.current ??= newIdempotencyKey();
      await businessApi.createBusiness({
        name: name.trim(),
        phone: normalizePhone(phone) ?? phone.trim(),
        email: normalizeEmail(email),
        description: description.trim(),
        role: role ?? 'supplier',
      }, idempotencyKey.current);
      if (canCreateBusiness(role)) {
        // Refresh persisted membership before the dashboard guard reads it.
        await refreshWorkspace();
        // Stays disabled while the app navigates to the dashboard.
        completion.complete(role ?? 'supplier');
      } else {
        // Defensive fallback; canCreateBusiness above normally prevents this.
        setNotice(COMING_SOON_MESSAGE);
        inFlight.current = false;
        setSubmitting(false);
      }
    } catch (caught) {
      inFlight.current = false;
      setSubmitting(false);
      setFormError(presentError(caught).message);
    }
  }

  if (completion.locked) return <AuthCard gapClassName="gap-5"><SignupCompletionNotice error={completion.error} retry={completion.retry} /></AuthCard>;

  return (
    <AuthCard gapClassName="gap-6 md:gap-6" className={cn('auth-card--business', businessFieldWrapperClass)}>
      <div className="flex w-full flex-col gap-2 text-center">
        {firstName ? <p className="text-sm text-subtle">Welcome, {firstName}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Create your business
        </h1>
        <p className="text-base text-subtle sm:text-lg">
          Set up your business account on sellonit
        </p>
      </div>

      <form
        className="flex w-full flex-col gap-6 text-left md:gap-5"
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
      >
        <TextField
          id="business-name"
          label="Business name"
          placeholder="Enter your business name"
          autoComplete="organization"
          value={name}
          onChange={(value) => {
            setName(value);
            clearFieldError('name');
          }}
          onBlur={() => handleBlur('name', name)}
          error={errors.name}
          inputRef={nameRef}
          disabled={submitting || completion.locked}
        />

        {/* Two columns from md up; stacks to one column when space is tight. */}
        <div className="flex w-full flex-col gap-6 md:grid md:grid-cols-2 md:gap-x-4">
          <TextField
            id="business-phone"
            label="Business phone number"
            placeholder="081 1234 568"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(value) => {
              setPhone(value);
              clearFieldError('phone');
            }}
            onBlur={() => handleBlur('phone', phone)}
            error={errors.phone}
            inputRef={phoneRef}
            disabled={submitting || completion.locked}
          />
          <TextField
            id="business-email"
            label="Business email"
            placeholder="you@example.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(value) => {
              setEmail(value);
              clearFieldError('email');
            }}
            onBlur={() => handleBlur('email', email)}
            error={errors.email}
            inputRef={emailRef}
            disabled={submitting || completion.locked}
          />
        </div>

        <div className="flex w-full flex-col gap-2">
          <label htmlFor="business-description" className="text-sm font-medium text-ink sm:text-lg">
            Business description
          </label>
          <div className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface px-5 py-3 transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 md:rounded-2xl">
            <textarea
              id="business-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={submitting || completion.locked}
              rows={3}
              placeholder="Tell us a little about what your business does"
              className="min-h-20 w-full min-w-0 flex-1 resize-none bg-transparent text-base text-ink outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:text-gray-500"
            />
          </div>
        </div>

        {/* Friendly, non-blocking notice (not an error): announced politely. */}
        {notice ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-left text-sm text-ink"
          >
            {notice}
          </p>
        ) : null}
        {formError ? <InlineError>{formError}</InlineError> : null}

        <PrimaryButton
          type="submit"
          disabled={!valid || submitting || completion.locked}
          loading={submitting}
          className="md:h-14 md:rounded-xl md:font-bold disabled:text-subtle"
        >
          {submitting ? 'Creating…' : 'Create Business'}
        </PrimaryButton>
      </form>

      <p className="text-center text-sm text-subtle">
        Own a business?{' '}
        {/* TODO(join-business): no route exists yet — placeholder only, do not build the flow. */}
        <button
          type="button"
          onClick={() => {
            setNotice(JOIN_COMING_SOON_MESSAGE);
            setFormError(null);
          }}
          className="font-semibold text-primary underline underline-offset-2 hover:text-primary-hover"
        >
          Join an existing business
        </button>
      </p>
    </AuthCard>
  );
}
