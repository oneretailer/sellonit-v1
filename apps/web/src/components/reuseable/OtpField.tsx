import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { pillFieldClass, pillInputClass } from './fieldStyles';

export type OtpFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  id: string;
  label: string;
  /** Only digits are kept; the field holds at most 6. */
  value: string;
  onChange: (code: string) => void;
  error?: boolean;
};

/** Labelled, pill-shaped numeric input for the 6-digit SMS code. */
export function OtpField({
  id,
  label,
  value,
  onChange,
  error = false,
  className,
  ...rest
}: OtpFieldProps) {
  return (
    <div className={cn('flex w-full flex-col gap-2 text-left', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className={pillFieldClass(error, rest.disabled)}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter 6-digit code"
          maxLength={6}
          aria-invalid={error || undefined}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className={cn(pillInputClass, 'font-medium tracking-[0.3em] placeholder:tracking-normal')}
          {...rest}
        />
      </div>
    </div>
  );
}
