import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/cn';
import { InlineError } from './InlineError';
import { pillFieldClass, pillInputClass } from './fieldStyles';

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Error message; replaces the helper text while shown. */
  error?: string | null;
  helper?: string;
  inputRef?: Ref<HTMLInputElement>;
};

/** Labelled pill text input with the error and helper text wired up for screen readers. */
export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  helper,
  className,
  inputRef,
  ...rest
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  return (
    <div className={cn('flex w-full flex-col gap-2 text-left', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink sm:text-lg">
        {label}
      </label>
      <div className={pillFieldClass(Boolean(error), rest.disabled)}>
        <input
          id={id}
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helper ? helperId : undefined}
          className={pillInputClass}
          {...rest}
        />
      </div>
      {error ? (
        <InlineError id={errorId}>{error}</InlineError>
      ) : helper ? (
        <p id={helperId} className="text-sm text-gray-500">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
