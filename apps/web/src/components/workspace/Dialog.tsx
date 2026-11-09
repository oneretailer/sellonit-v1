'use client';

/**
 * Shared modal base for every workspace overlay (confirmations, success,
 * discard, switch-business, adjust-stock). Built on the native <dialog> top
 * layer already used by the app: focus containment, Escape handling, focus
 * restoration, and scroll lock.
 *
 * Panel: white, 1px border, 24px radius, fluid width up to 460px (or 540px for
 * form dialogs), centered (or bottom-anchored below sm when sheetOnMobile is
 * enabled), hugging height; scrolls inside the overlay on short viewports.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { DashboardIcon } from '@/components/dashboard/icons';

export type DialogTone = 'warning' | 'info' | 'success' | 'danger';
export type DialogSize = 'md' | 'lg';

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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  title,
  description,
  tone = 'info',
  size = 'md',
  sheetOnMobile = false,
  hideIcon = false,
  showCloseButton = false,
  closeLabel = 'Close dialog',
  returnFocusTo,
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
  size?: DialogSize;
  /** Anchor toward the bottom of the screen below `sm` while staying centered from `sm` up. */
  sheetOnMobile?: boolean;
  /** Omit the decorative tone icon (used by form dialogs with a close button). */
  hideIcon?: boolean;
  /** Render a top-right "×" close button with an accessible label. */
  showCloseButton?: boolean;
  closeLabel?: string;
  /** Element to restore focus to when the dialog closes (defaults to previously focused element). */
  returnFocusTo?: HTMLElement | null;
  /** Defaults to a line icon matching the tone. Marked decorative. */
  icon?: ReactNode;
  children?: ReactNode;
  /** Action row: secondary (outlined, safe) first, primary (solid) second. */
  actions: ReactNode;
  /** Safe/cancel action (Escape + backdrop click). */
  onClose: () => void;
  /** Disable Escape/backdrop/close-button while a request is in flight. */
  closeLocked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null | undefined>(returnFocusTo);
  const wasOpenRef = useRef(false);
  const id = useId();

  useEffect(() => {
    returnFocusRef.current = returnFocusTo;
  }, [returnFocusTo]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!wasOpenRef.current) {
        previousFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        wasOpenRef.current = true;
      }
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        const target = returnFocusRef.current ?? previousFocusRef.current;
        previousFocusRef.current = null;
        if (target && target.isConnected) {
          target.focus();
        }
      }
    }
  }, [open]);

  // Also restore focus if a parent conditionally unmounts an open Dialog on close.
  useEffect(
    () => () => {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        const target = returnFocusRef.current ?? previousFocusRef.current;
        previousFocusRef.current = null;
        if (target && target.isConnected) {
          target.focus();
        }
      }
    },
    [],
  );

  // Lock body scroll while open; restore on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Initial focus goes to the safe (non-destructive) action or first focusable control.
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    if (!dialog) return;
    const initial =
      dialog.querySelector<HTMLElement>('[data-dialog-initial]') ??
      dialog.querySelector<HTMLElement>('[data-dialog-safe]') ??
      dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    initial?.focus();
  }, [open]);

  // Explicit Tab wrap + Escape fallback (ensures consistent focus trap across browsers & jsdom).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      const dialog = ref.current;
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!closeLocked) onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeLocked, onClose, open]);

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
      className={cn(
        'mx-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl border border-line bg-white p-6 text-left text-ink shadow-xl backdrop:bg-black/60 sm:p-8',
        sheetOnMobile ? 'mb-4 mt-auto sm:my-auto' : 'my-auto',
        size === 'lg' ? 'max-w-[540px]' : 'max-w-[460px]',
      )}
    >
      <div className="flex flex-col gap-6">
        {!hideIcon ? (
          <div className="flex items-start justify-between gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                toneStyles[tone],
              )}
            >
              {icon ?? <DashboardIcon name={toneIcons[tone]} className="size-5" />}
            </span>
            {showCloseButton ? (
              <button
                type="button"
                aria-label={closeLabel}
                disabled={closeLocked}
                onClick={onClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-subtle transition-colors hover:bg-gray-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                <DashboardIcon name="close" className="size-5" />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 id={`${id}-title`} className="font-heading text-xl font-semibold text-ink">
              {title}
            </h2>
            <p id={`${id}-description`} className="text-sm leading-6 text-subtle">
              {description}
            </p>
          </div>
          {hideIcon && showCloseButton ? (
            <button
              type="button"
              aria-label={closeLabel}
              disabled={closeLocked}
              onClick={onClose}
              className="-mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl text-subtle transition-colors hover:bg-gray-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <DashboardIcon name="close" className="size-5" />
            </button>
          ) : null}
        </div>
        {children}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">{actions}</div>
      </div>
    </dialog>
  );
}

/** Equal-width dialog buttons. Secondary outlined; primary solid orange.
 * Below sm they stack with the primary on top (flex-col-reverse). */
export const dialogButtonClass =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors sm:w-1/2';
export const dialogSecondaryClass = cn(
  dialogButtonClass,
  'border border-primary bg-white text-ink hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60',
);
export const dialogPrimaryClass = cn(
  dialogButtonClass,
  'bg-primary text-ink hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary-disabled disabled:text-subtle',
);
