'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Spinner } from '@/components/reuseable/Spinner';
import { Dialog, dialogPrimaryClass, dialogSecondaryClass } from '@/components/workspace/Dialog';
import { Input } from '@/components/workspace/Field';
import { useToast } from '@/components/workspace/ToastProvider';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useAdjustStock } from '@/lib/inventory/queries';
import type { AdjustmentDirection, InventoryItem } from '@/lib/inventory/types';
import { formatProposedChange, validateStockAdjustment } from '@/lib/inventory/validation';
import { presentError } from '@/lib/workspace/errors';

const countFormat = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

const DIRECTION_OPTIONS: readonly { id: AdjustmentDirection; label: string }[] = [
  { id: 'increase', label: 'Increase' },
  { id: 'decrease', label: 'Decrease' },
];

export function AdjustStockDialog({
  open,
  item,
  returnFocusTo,
  onClose,
  onRefreshConflict,
}: {
  open: boolean;
  item: InventoryItem;
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
  /** Triggered on 409 conflict so the parent list refetches authoritative stock. */
  onRefreshConflict?: () => Promise<InventoryItem | undefined>;
}) {
  const adjustmentLabelId = useId();
  const increaseRef = useRef<HTMLInputElement>(null);
  const decreaseRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const notify = useToast();
  const adjustMutation = useAdjustStock();

  const [direction, setDirection] = useState<AdjustmentDirection>('increase');
  const [quantityText, setQuantityText] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverFieldError, setServerFieldError] = useState<string | null>(null);
  const [submitAlert, setSubmitAlert] = useState<string | null>(null);
  const [conflictAvailable, setConflictAvailable] = useState<number | null>(null);

  const currentAvailable = conflictAvailable ?? item.availableQuantity;
  const validation = validateStockAdjustment(quantityText, direction, currentAvailable);
  const proposed = formatProposedChange({
    direction,
    quantityText,
    productName: item.name,
    availableQuantity: currentAvailable,
  });

  // Show decrease-below-zero error immediately as typed, or numeric error after blur/submit.
  const exceedsDecreaseCap =
    direction === 'decrease' &&
    /^\d+$/.test(quantityText.trim()) &&
    Number.parseInt(quantityText.trim(), 10) > currentAvailable;
  const quantityError =
    serverFieldError ?? (touched || exceedsDecreaseCap ? validation.error : null);
  const submitting = adjustMutation.isPending;
  const primaryLabel = direction === 'increase' ? 'Increase stock' : 'Decrease stock';

  function selectDirection(next: AdjustmentDirection, focusInput = false) {
    setDirection(next);
    setServerFieldError(null);
    setSubmitAlert(null);
    if (focusInput) {
      if (next === 'increase') increaseRef.current?.focus();
      else decreaseRef.current?.focus();
    }
  }

  function handleRadioKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (submitting) return;
    if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp'
    ) {
      event.preventDefault();
      const next: AdjustmentDirection = direction === 'increase' ? 'decrease' : 'increase';
      selectDirection(next, true);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    onClose();
  }

  async function handleSubmit() {
    setTouched(true);
    setServerFieldError(null);
    setSubmitAlert(null);
    if (!validation.valid || submitting) return;

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await adjustMutation.mutateAsync({
        productId: item.productId,
        input: { direction, quantity: validation.quantity },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      notify({
        title: 'Stock updated',
        description: `${item.name} available stock has been updated.`,
      });
      onClose();
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof DOMException && caught.name === 'AbortError') return;

      if (caught instanceof ApiError) {
        if (caught.fields?.quantity) {
          setServerFieldError(caught.fields.quantity);
          return;
        }
        if (caught.status === 422) {
          setServerFieldError(caught.message);
          return;
        }
        if (caught.status === 409) {
          const refreshed = await onRefreshConflict?.();
          const updatedQty = refreshed?.availableQuantity;
          if (typeof updatedQty === 'number') {
            setConflictAvailable(updatedQty);
            setSubmitAlert(
              `Available stock changed to ${countFormat.format(updatedQty)} while you were editing. Review your adjustment and try again.`,
            );
          } else {
            setSubmitAlert(
              'Available stock changed while you were editing. Review the current stock above and try again.',
            );
          }
          return;
        }
      }
      setSubmitAlert(presentError(caught).message);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  return (
    <Dialog
      open={open}
      title="Adjust stock"
      description="Review the change before updating this product."
      size="lg"
      sheetOnMobile
      hideIcon
      showCloseButton
      closeLabel="Close adjust stock dialog"
      returnFocusTo={returnFocusTo}
      closeLocked={submitting}
      onClose={() => {
        if (!submitting) onClose();
      }}
      actions={
        <>
          <button
            type="button"
            data-dialog-safe
            onClick={handleCancel}
            className={dialogSecondaryClass}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!validation.valid || submitting}
            onClick={() => void handleSubmit()}
            className={dialogPrimaryClass}
          >
            {submitting ? <Spinner /> : null}
            {primaryLabel}
          </button>
        </>
      }
    >
      {/* Product block */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-[length:var(--text-ws-body)] font-medium text-ink">
          {item.name}
        </p>
        <p className="truncate text-[length:var(--text-ws-caption)] text-caption">{item.sku}</p>
      </div>

      {/* Current available & Reserved summary box */}
      <div className="grid grid-cols-2 gap-4 rounded-ws-card bg-canvas p-4">
        <div className="min-w-0">
          <p className="text-[length:var(--text-ws-caption)] text-subtle">
            Current available stock
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-ink">
            {countFormat.format(currentAvailable)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[length:var(--text-ws-caption)] text-subtle">
            Reserved · System-managed
          </p>
          {typeof item.reservedQuantity === 'number' ? (
            <p className="mt-1 font-heading text-2xl font-semibold text-ink">
              {countFormat.format(item.reservedQuantity)}
            </p>
          ) : (
            <p className="mt-2 text-[length:var(--text-ws-body)] font-medium text-subtle">
              — Unavailable
            </p>
          )}
        </div>
      </div>

      {/* Adjustment direction radio cards */}
      <div className="flex flex-col gap-1.5">
        <span
          id={adjustmentLabelId}
          className="text-[length:var(--text-ws-label)] font-medium text-ink"
        >
          Adjustment
        </span>
        <div
          role="radiogroup"
          aria-labelledby={adjustmentLabelId}
          onKeyDown={handleRadioKeyDown}
          className="grid grid-cols-2 gap-3"
        >
          {DIRECTION_OPTIONS.map((option) => {
            const selected = direction === option.id;
            const inputRef = option.id === 'increase' ? increaseRef : decreaseRef;
            return (
              <label
                key={option.id}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-ws-control border px-3.5 py-2.5 text-[length:var(--text-ws-body)] font-medium text-ink transition-colors focus-within:ring-2 focus-within:ring-primary/25',
                  selected
                    ? 'border-primary bg-primary-tint'
                    : 'border-line bg-surface hover:bg-canvas',
                  submitting && 'cursor-not-allowed opacity-70',
                )}
              >
                <input
                  ref={inputRef}
                  type="radio"
                  name="stock-adjustment-direction"
                  value={option.id}
                  checked={selected}
                  disabled={submitting}
                  tabIndex={selected ? 0 : -1}
                  onChange={() => selectDirection(option.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border bg-surface transition-colors',
                    selected ? 'border-primary' : 'border-line',
                  )}
                >
                  {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                </span>
                <span className="truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Quantity input */}
      <Input
        id="adjust-stock-quantity"
        label="Quantity"
        required
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={quantityText}
        disabled={submitting}
        onChange={(event) => {
          setQuantityText(event.target.value);
          setServerFieldError(null);
          setSubmitAlert(null);
        }}
        onBlur={() => setTouched(true)}
        helper="Number of units for this change."
        error={quantityError}
      />

      {/* Live proposed change box */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="rounded-ws-card border border-line bg-canvas p-4"
      >
        <p className="text-[length:var(--text-ws-body)] font-semibold text-ink">
          {proposed.headline}
        </p>
        <p className="mt-1 text-[length:var(--text-ws-caption)] leading-5 text-subtle">
          {proposed.detail}
        </p>
      </div>

      {submitAlert ? (
        <p
          role="alert"
          className="rounded-ws-card border border-danger/30 bg-danger-tint px-4 py-3 text-[length:var(--text-ws-body)] text-danger"
        >
          {submitAlert}
        </p>
      ) : null}

      {/* Footnote */}
      <p className="text-[length:var(--text-ws-caption)] text-caption">
        Reserved stock is read-only and cannot be changed here.
      </p>
    </Dialog>
  );
}
