'use client';

import type { Ref } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { InlineError } from './InlineError';
import { pillFieldClass, pillInputClass } from './fieldStyles';
import { EyeIcon, EyeOffIcon } from './icons';

export type PasswordFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  /** Error message shown under the field with a red "!"; the field gets a red border. */
  error?: string | null;
  /** Extra ids to append to aria-describedby (e.g. a checklist). */
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
};

/**
 * Pill password input with an eye / eye-off button inside its right edge. The
 * button is labelled "Show password" / "Hide password" and reports its state
 * with aria-pressed.
 */
export function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  autoComplete,
  error,
  describedBy,
  inputRef,
  autoFocus = false,
  disabled = false,
  maxLength = 128,
  className,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const ids = [error ? errorId : null, describedBy ?? null].filter(Boolean).join(' ');
  return (
    <div className={cn('flex w-full flex-col gap-2 text-left', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className={pillFieldClass(Boolean(error), disabled)}>
        <input
          id={id}
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids || undefined}
          className={pillInputClass}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={disabled}
          className="shrink-0 rounded-full p-2 text-subtle hover:text-ink disabled:opacity-50"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error ? <InlineError id={errorId}>{error}</InlineError> : null}
    </div>
  );
}
