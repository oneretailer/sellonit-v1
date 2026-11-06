'use client';

/**
 * Shared form primitives for workspace screens: label + required asterisk +
 * helper + error + orange focus + disabled. Errors use the existing InlineError
 * (red circled icon + red text) and are associated via aria-describedby.
 */
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';
import { InlineError } from '@/components/reuseable/InlineError';
import { DashboardIcon } from '@/components/dashboard/icons';

const controlBase =
  'min-h-11 w-full rounded-xl border bg-white px-4 text-sm text-ink outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-gray-500';
const bareInput =
  'min-h-11 w-full min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:text-gray-500';

export function fieldBorder(hasError: boolean): string {
  return hasError ? 'border-danger focus:border-danger focus:ring-danger/15' : 'border-line';
}

export function Field({
  id,
  label,
  required = false,
  hideLabel = false,
  helper,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  /** Visually hide the label (filters); it stays available to screen readers. */
  hideLabel?: boolean;
  helper?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-sm font-medium text-ink', hideLabel && 'sr-only')}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">(required)</span> : null}
      </label>
      {children}
      {error ? (
        <InlineError id={`${id}-error`}>{error}</InlineError>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-xs leading-5 text-subtle">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  id?: string;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string | null;
  /** Visual prefix inside the control (e.g. ₦). */
  prefix?: string;
};

/** Labelled input. With a prefix, the border/focus ring live on the wrapper. */
export function Input({
  id: idProp,
  label,
  required,
  helper,
  error,
  prefix,
  className,
  ...rest
}: InputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
  const input = (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      className={cn(
        prefix ? bareInput : cn(controlBase, fieldBorder(Boolean(error))),
        prefix && 'pl-2',
        className,
      )}
      {...rest}
    />
  );
  return (
    <Field id={id} label={label} required={required} helper={helper} error={error}>
      {prefix ? (
        <div
          className={cn(
            'flex items-center rounded-xl border bg-white transition-colors focus-within:ring-4',
            error
              ? 'border-danger focus-within:border-danger focus-within:ring-danger/15'
              : 'border-line focus-within:border-primary focus-within:ring-primary/15',
            rest.disabled && 'bg-canvas',
          )}
        >
          <span aria-hidden="true" className="pl-4 text-sm font-medium text-subtle">
            {prefix}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id?: string;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string | null;
};

export function Textarea({
  id: idProp,
  label,
  required,
  helper,
  error,
  className,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
  return (
    <Field id={id} label={label} required={required} helper={helper} error={error}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className={cn(
          controlBase,
          'min-h-28 resize-y py-3',
          fieldBorder(Boolean(error)),
          className,
        )}
        {...rest}
      />
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id?: string;
  label: string;
  required?: boolean;
  hideLabel?: boolean;
  helper?: string;
  error?: string | null;
  /** Sizing for the whole field (label + control). */
  wrapperClassName?: string;
};

export function Select({
  id: idProp,
  label,
  required,
  hideLabel,
  helper,
  error,
  className,
  wrapperClassName,
  children,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
  return (
    <Field
      id={id}
      label={label}
      required={required}
      hideLabel={hideLabel}
      helper={helper}
      error={error}
      className={wrapperClassName}
    >
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(
            controlBase,
            'appearance-none pr-10',
            fieldBorder(Boolean(error)),
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle"
        >
          <DashboardIcon name="chevron-down" className="size-4" />
        </span>
      </div>
    </Field>
  );
}
