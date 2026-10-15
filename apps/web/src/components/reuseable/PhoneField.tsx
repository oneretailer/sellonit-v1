import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/cn';
import { pillFieldClass, pillInputClass } from './fieldStyles';

export type PhoneFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'prefix'
> & {
  id: string;
  /** The 10 national digits, without the country code or leading zero. */
  value: string;
  onChange: (digits: string) => void;
  error?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

/**
 * Pill-shaped phone input with a fixed "+234" country code inside it, followed
 * by the national number. Numeric keypad on mobile.
 */
export function PhoneField({
  id,
  value,
  onChange,
  error = false,
  inputRef,
  className,
  ...rest
}: PhoneFieldProps) {
  return (
    <div className={cn(pillFieldClass(error), className)}>
      <label htmlFor={id} className="sr-only">
        Phone number
      </label>
      <span className="shrink-0 border-r border-line pr-3 text-base font-medium text-ink">
        +234
      </span>
      <input
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="8072994315"
        aria-invalid={error || undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={pillInputClass}
        {...rest}
      />
    </div>
  );
}
