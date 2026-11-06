'use client';

/**
 * Shared modal base for every workspace overlay (confirmations, success,
 * discard, switch-business). Built on the native <dialog> top layer already
 * used by the app: focus containment, Escape handling and scroll lock.
 *
 * Panel: white, 1px border, 24px radius, fluid width up to 460px, centered,
 * hugging height; scrolls inside the overlay on short viewports.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { DashboardIcon } from '@/components/dashboard/icons';

export type DialogTone = 'warning' | 'info' | 'success' | 'danger';

const toneStyles: Record<DialogTone, string> = {
  warning: 'bg-orange-50 text-primary',
  info: 'bg-orange-50 text-primary',
  success: 'bg-green-50 text-success',
  danger: 'bg-red-50 text-danger',
};

const toneIcons: Record<DialogTone, 'alert' | 'info' | 'check-circle'> = {
  warning: 'alert',
  info: 'info',
  success: 'check-circle',
  danger: 'alert',
};

export function Dialog({
  open,
  title,
  description,
  tone = 'info',
  icon,
  children,
  actions,
  onClose,
  closeLocked = false,
}: {
  open: boolean;
  title: string;
  description: string;
  tone?: DialogTone;
  /** Defaults to a line icon matching the tone. Marked decorative. */
  icon?: ReactNode;
  children?: ReactNode;
  /** Action row: secondary (outlined, safe) first, primary (solid) second. */
  actions: ReactNode;
  /** Safe/cancel action (Escape + backdrop click). */
  onClose: () => void;
  /** Disable Escape/backdrop while a destructive request is in flight. */
  closeLocked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Lock body scroll while open; restore on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Initial focus goes to the safe (non-destructive) action.
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('[data-dialog-safe]')?.focus();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeLocked) onClose();
      }}
      onClick={(event) => {
        // Backdrop clicks target the dialog itself but land outside its box.
        // Padding clicks inside the panel must NOT close it.
        if (event.target !== ref.current || closeLocked) return;
        const rect = ref.current.getBoundingClientRect();
        const outside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;
        if (outside) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[460px] overflow-y-auto rounded-3xl border border-line bg-white p-6 text-left text-ink shadow-xl backdrop:bg-black/60 sm:p-8"
    >
      <div className="flex flex-col gap-6">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            toneStyles[tone],
          )}
        >
          {icon ?? <DashboardIcon name={toneIcons[tone]} className="size-5" />}
        </span>
        <div className="flex flex-col gap-3">
          <h2 id={`${id}-title`} className="font-heading text-xl font-semibold text-ink">
            {title}
          </h2>
          <p id={`${id}-description`} className="text-sm leading-6 text-subtle">
            {description}
          </p>
        </div>
        {children}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">{actions}</div>
      </div>
    </dialog>
  );
}

/** Equal-width dialog buttons. Secondary outlined orange; primary solid orange.
 * Below sm they stack with the primary on top (flex-col-reverse). */
export const dialogButtonClass =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors sm:w-1/2';
export const dialogSecondaryClass = cn(
  dialogButtonClass,
  'border border-primary bg-white text-ink hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60',
);
export const dialogPrimaryClass = cn(
  dialogButtonClass,
  'bg-primary text-ink hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary-disabled',
);
