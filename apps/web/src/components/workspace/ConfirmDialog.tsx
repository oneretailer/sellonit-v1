'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { SecondaryButton } from '@/components/reuseable/SecondaryButton';
import { InlineError } from '@/components/reuseable/InlineError';

export function ConfirmDialog({ open, title, description, children, confirmLabel, pending = false, error, onConfirm, onClose }: {
  open: boolean; title: string; description: string; children?: ReactNode; confirmLabel: string; pending?: boolean; error?: string | null; onConfirm: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-black/40">
    <h2 id={`${id}-title`} className="font-heading text-2xl font-semibold">{title}</h2>
    <p id={`${id}-description`} className="mt-3 text-sm leading-6 text-subtle">{description}</p>
    <div className="mt-5 space-y-4">{children}</div>
    {error ? <InlineError className="mt-4">{error}</InlineError> : null}
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
      <SecondaryButton appearance="outline" shape="rounded" disabled={pending} onClick={onClose}>Cancel</SecondaryButton>
      <PrimaryButton shape="rounded" loading={pending} disabled={pending} onClick={onConfirm} autoFocus>{confirmLabel}</PrimaryButton>
    </div>
  </dialog>;
}
