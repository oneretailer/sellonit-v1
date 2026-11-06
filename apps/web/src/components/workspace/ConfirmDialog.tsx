'use client';

/**
 * Confirmation overlay built on the shared Dialog base. Keeps the existing
 * admin-workspace API (confirmLabel/pending/error). Cancel is the safe action:
 * it receives initial focus and handles Escape/backdrop.
 */
import type { ReactNode } from 'react';
import { Dialog, dialogPrimaryClass, dialogSecondaryClass, type DialogTone } from './Dialog';
import { InlineError } from '@/components/reuseable/InlineError';
import { Spinner } from '@/components/reuseable/Spinner';
import { cn } from '@/lib/cn';

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'warning',
  pending = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: DialogTone;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      tone={tone}
      onClose={onClose}
      closeLocked={pending}
      actions={
        <>
          <button
            type="button"
            data-dialog-safe
            className={dialogSecondaryClass}
            disabled={pending}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(
              dialogPrimaryClass,
              tone === 'danger' && 'bg-danger text-white hover:bg-danger/90',
            )}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error ? <InlineError>{error}</InlineError> : null}
    </Dialog>
  );
}
