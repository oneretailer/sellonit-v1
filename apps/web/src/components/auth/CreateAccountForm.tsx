'use client';

import { useRef, useState, type FormEvent, type RefObject } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { mapRegisterError, registerUser, toRegisterUserRequest } from '@/lib/auth/api';
import { setPendingVerificationEmail } from '@/lib/auth/pendingVerification';
import {
  confirmError,
  emailError,
  EMAIL_MAX_LENGTH,
  FORM_ERRORS,
  isConfirmMatching,
  isPasswordValid,
  isRegisterFormValid,
  NAME_MAX_LENGTH,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_RULES,
} from '@/lib/validation/auth';

/* ── Inline icons (lucide-react is not installed) ──────────────────────── */

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5"
    >
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5 shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

/* ── Field chrome (Figma: pill input, 558 inner width, label above) ────── */

const pillFieldClass = (invalid = false) =>
  `flex h-14 w-full items-center gap-3 rounded-xl border ${invalid ? 'border-danger' : 'border-line'} bg-surface px-5 transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 sm:h-[60px]`;
const pillInputClass =
  'h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-gray-500 sm:h-[60px] sm:text-lg lg:h-16 lg:text-xl';
const fieldLabelClass = 'text-base font-medium text-ink sm:text-lg lg:text-xl';
const helperTextClass = 'text-sm text-subtle lg:text-base';
const errorTextClass = 'text-sm text-danger lg:text-base';

type TextFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | null;
  helper?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  type?: 'text' | 'email';
  inputMode?: 'text' | 'email';
  autoComplete: string;
  maxLength?: number;
  disabled?: boolean;
};

function PillTextField({
  id,
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  helper,
  inputRef,
  type = 'text',
  inputMode,
  autoComplete,
  maxLength,
  disabled = false,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(' ');
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <div className={pillFieldClass(Boolean(error))}>
        <input
          id={id}
          ref={inputRef}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={pillInputClass}
        />
      </div>
      {error ? (
        <p
          id={errorId}
          aria-live="polite"
          className={cn('flex items-center gap-2', errorTextClass)}
        >
          <AlertCircleIcon />
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className={helperTextClass}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  describedBy: string | undefined;
  invalid?: boolean;
  disabled?: boolean;
};

/** Pill input with its own show/hide eye button inside the right edge. */
function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  visible,
  onToggleVisibility,
  inputRef,
  describedBy,
  invalid = false,
  disabled = false,
}: PasswordFieldProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <div className={pillFieldClass(invalid)}>
        <input
          id={id}
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={pillInputClass}
        />
        {/* Icon reflects the action: eye = reveal, eye-off = hide. */}
        <button
          type="button"
          onClick={onToggleVisibility}
          disabled={disabled}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="shrink-0 rounded-full p-2 text-subtle hover:text-ink"
        >
          {visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
    </div>
  );
}

/* ── Password checklist (Figma: bullet dot + rule text) ────────────────── */

function PasswordChecklist({ password }: { password: string }) {
  const active = password.length > 0;
  return (
    <ul id="password-rules" className="flex flex-col gap-2">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        // Neutral gray until the field has content; then green/red per rule.
        const tone = !active ? 'text-[#6B7280]' : met ? 'text-success' : 'text-danger';
        return (
          <li key={rule.id} className={cn('flex items-center gap-2', tone)}>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
            <span className="text-sm lg:text-base">{rule.label}</span>
            <span className="sr-only">{met ? 'requirement met' : 'requirement not met'}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Create account form (Figma: fields and buttons) ───────────────────── */

type FieldKey = 'firstName' | 'lastName' | 'email' | 'password' | 'confirm' | 'terms';

export function CreateAccountForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const fullName = `${firstName} ${lastName}`.trim();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Partial<Record<'firstName' | 'lastName' | 'email' | 'password', string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  const valid = isRegisterFormValid({
    fullName,
    email,
    password,
    confirm,
    termsAccepted,
  });

  const showError = (key: 'firstName' | 'lastName' | 'email') =>
    Boolean(touched[key]) || submitAttempted;
  const resolvedFirstNameError =
    serverFieldErrors.firstName ??
    (showError('firstName') && !firstName.trim() ? 'Enter your first name.' : null);
  const resolvedLastNameError =
    serverFieldErrors.lastName ??
    (showError('lastName') && !lastName.trim() ? 'Enter your last name.' : null);
  const resolvedEmailError =
    serverFieldErrors.email ?? (showError('email') ? emailError(email) : null);
  // Live on every keystroke (Figma note: "Autodetect password confirmation").
  const confirmMessage = confirmError(password, confirm);
  const termsError =
    (submitAttempted || touched.terms) && !termsAccepted ? FORM_ERRORS.termsRequired : null;

  const fieldRefs: Record<FieldKey, RefObject<HTMLInputElement | null>> = {
    firstName: firstNameRef,
    lastName: lastNameRef,
    email: emailRef,
    password: passwordRef,
    confirm: confirmRef,
    terms: termsRef,
  };

  function firstInvalidField(): FieldKey | null {
    if (!firstName.trim()) return 'firstName';
    if (!lastName.trim()) return 'lastName';
    if (emailError(email) !== null) return 'email';
    if (!isPasswordValid(password)) return 'password';
    if (!isConfirmMatching(password, confirm)) return 'confirm';
    if (!termsAccepted) return 'terms';
    return null;
  }

  function clearServerErrors() {
    setServerFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setSubmitAttempted(true);
    if (!valid) {
      // No request: mark everything touched and focus the first invalid field.
      const first = firstInvalidField();
      if (first) {
        fieldRefs[first].current?.focus();
      }
      return;
    }
    clearServerErrors();
    setIsSubmitting(true);
    try {
      await registerUser(
        toRegisterUserRequest({ fullName, email, password, confirm, termsAccepted }),
      );
      // Only the email is kept for the verify page — never the password.
      setPendingVerificationEmail(normalizeEmail(email));
      router.push('/auth/verify-email');
    } catch (error) {
      const mapped = mapRegisterError(error);
      setServerFieldErrors(mapped.fields);
      setFormError(mapped.form);
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="flex w-full  flex-col gap-0 text-left"
      >
        {/* fields: vertical, gap 32 */}
        <div className="mb-6 flex w-full flex-col gap-6 md:mb-12">
          <PillTextField
            id="firstName"
            label="First name"
            placeholder="Enter your first name"
            value={firstName}
            onChange={(value) => {
              setFirstName(value);
              setServerFieldErrors((current) => ({ ...current, firstName: undefined }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, firstName: true }))}
            error={resolvedFirstNameError}
            autoComplete="given-name"
            maxLength={NAME_MAX_LENGTH}
            inputRef={firstNameRef}
            disabled={isSubmitting}
          />
          <PillTextField
            id="lastName"
            label="Last name"
            placeholder="Enter your last name"
            value={lastName}
            onChange={(value) => {
              setLastName(value);
              setServerFieldErrors((current) => ({ ...current, lastName: undefined }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, lastName: true }))}
            error={resolvedLastNameError}
            autoComplete="family-name"
            maxLength={NAME_MAX_LENGTH}
            inputRef={lastNameRef}
            disabled={isSubmitting}
          />

          <PillTextField
            id="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(value) => {
              setEmail(value);
              setServerFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, email: true }))}
            error={resolvedEmailError}
            helper="We'll use your email for account recovery and important account messages."
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
            inputRef={emailRef}
            disabled={isSubmitting}
          />

          <div className="flex w-full flex-col gap-2">
            <PasswordField
              id="password"
              label="Password"
              placeholder="Create password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                clearServerErrors();
              }}
              visible={showPassword}
              onToggleVisibility={() => setShowPassword((current) => !current)}
              inputRef={passwordRef}
              describedBy={
                serverFieldErrors.password ? 'password-rules password-error' : 'password-rules'
              }
              invalid={Boolean(serverFieldErrors.password)}
              disabled={isSubmitting}
            />
            <PasswordChecklist password={password} />
            {serverFieldErrors.password ? (
              <p id="password-error" className={errorTextClass}>
                {serverFieldErrors.password}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2">
            <PasswordField
              id="confirmPassword"
              label="Confirm password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(value) => setConfirm(value)}
              visible={showConfirm}
              onToggleVisibility={() => setShowConfirm((current) => !current)}
              inputRef={confirmRef}
              describedBy={confirmMessage ? 'confirm-error' : undefined}
              invalid={Boolean(confirmMessage)}
              disabled={isSubmitting}
            />
            {/* mismatch error: live region, shown while confirm is non-empty and differs */}
            <div aria-live="polite">
              {confirmMessage ? (
                <p id="confirm-error" className={cn('flex items-center gap-2', errorTextClass)}>
                  <AlertCircleIcon />
                  {confirmMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* terms checkbox: real input, whole row clickable */}
        <div className="mb-6 flex w-full flex-col gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              ref={termsRef}
              type="checkbox"
              checked={termsAccepted}
              disabled={isSubmitting}
              onChange={(event) => {
                setTermsAccepted(event.target.checked);
                setTouched((current) => ({ ...current, terms: true }));
              }}
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? 'terms-error' : undefined}
              className="size-5 shrink-0 accent-primary"
            />
            <span className="text-base text-ink lg:text-lg">I agree with the terms and policy</span>
          </label>
          {termsError ? (
            <p id="terms-error" className={errorTextClass}>
              {termsError}
            </p>
          ) : null}
        </div>

        {/* button and footer: gap 24 */}
        <div className="flex w-full flex-col gap-2 sm:gap-4">
          {/* form-level errors (rate limit, network, server) */}
          <div aria-live="polite">
            {formError ? (
              <p role="alert" className={errorTextClass}>
                {formError}
              </p>
            ) : null}
          </div>

          {/* primary button: full width, 68 tall at lg, radius 36, semibold, dark text */}
          <button
            type="submit"
            disabled={!valid || isSubmitting}
            aria-disabled={!valid || isSubmitting}
            aria-busy={isSubmitting || undefined}
            className={cn(
              'flex h-14 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-xl leading-7 font-semibold text-ink transition-colors sm:h-16 sm:text-2xl sm:leading-8 lg:h-[68px] lg:py-4 lg:text-[25px] lg:leading-9',
              isSubmitting
                ? 'cursor-not-allowed bg-[#CC7000]'
                : valid
                  ? 'bg-primary hover:bg-primary-hover active:bg-[#CC7000]'
                  : 'cursor-not-allowed bg-primary-disabled',
              isSubmitting && 'cursor-progress',
            )}
          >
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-base text-subtle lg:text-lg">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="font-semibold text-ink underline underline-offset-2"
            >
              Log in here
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
