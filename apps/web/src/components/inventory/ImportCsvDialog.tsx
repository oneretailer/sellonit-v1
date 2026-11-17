'use client';

/**
 * "Import stock from CSV" modal (~560px wide).
 *
 * Implemented as an explicit 8-state machine:
 *   `idle` → `selected` → `uploading` → `validating` → `errors` | `ready` → `complete` | `failed`
 */
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { DashboardIcon } from '@/components/dashboard/icons';
import { InlineError } from '@/components/reuseable/InlineError';
import { Spinner } from '@/components/reuseable/Spinner';
import { Dialog, dialogPrimaryClass, dialogSecondaryClass } from '@/components/workspace/Dialog';
import { useToast } from '@/components/workspace/ToastProvider';
import { isEndpointNotImplemented } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { inventoryApi } from '@/lib/inventory/inventoryApi';
import { useConfirmCsvImport } from '@/lib/inventory/queries';
import type { CsvImportRowError, CsvImportRowPreview, CsvImportStage } from '@/lib/inventory/types';
import { presentError } from '@/lib/workspace/errors';

const countFormat = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

const RESERVED_NOTE =
  "You'll review validation results before confirming the import. Reserved stock is system-managed and cannot be changed here.";

type MachineState = {
  stage: CsvImportStage;
  file: File | null;
  progress: number;
  importId?: string;
  validRows: CsvImportRowPreview[];
  rowErrors: CsvImportRowError[];
  updatedCount: number;
  failureMessage: string | null;
  endpointUnmounted: boolean;
};

const INITIAL_MACHINE: MachineState = {
  stage: 'idle',
  file: null,
  progress: 0,
  validRows: [],
  rowErrors: [],
  updatedCount: 0,
  failureMessage: null,
  endpointUnmounted: false,
};

function isCsvFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv')) return true;
  return file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
}

function FileRow({
  fileName,
  caption,
  progress,
  tone = 'default',
  onClear,
}: {
  fileName: string;
  caption: string;
  progress?: number;
  tone?: 'default' | 'success' | 'danger';
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-ws-card border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-ws-control',
            tone === 'success'
              ? 'bg-success-tint text-success'
              : tone === 'danger'
                ? 'bg-danger-tint text-danger'
                : 'bg-primary-tint text-primary',
          )}
        >
          <DashboardIcon
            name={tone === 'success' ? 'check-circle' : tone === 'danger' ? 'alert' : 'file'}
            className="size-5"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[length:var(--text-ws-body)] font-medium text-ink">
            {fileName}
          </p>
          <p className="truncate text-[length:var(--text-ws-caption)] text-caption">{caption}</p>
        </div>
        {onClear ? (
          <button
            type="button"
            aria-label="Remove selected file"
            onClick={onClear}
            className="flex size-8 shrink-0 items-center justify-center rounded-ws-control text-caption transition-colors hover:bg-canvas hover:text-ink"
          >
            <DashboardIcon name="close" className="size-4" />
          </button>
        ) : null}
      </div>
      {typeof progress === 'number' ? (
        <div
          role="progressbar"
          aria-label="CSV upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-1.5 overflow-hidden rounded-full bg-primary-tint"
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.max(progress, 8)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ImportCsvDialog({
  open,
  returnFocusTo,
  onClose,
}: {
  open: boolean;
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const notify = useToast();
  const confirmMutation = useConfirmCsvImport();

  const [machine, setMachine] = useState<MachineState>(INITIAL_MACHINE);
  const [dragOver, setDragOver] = useState(false);
  const [fileRejectError, setFileRejectError] = useState<string | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const confirming = confirmMutation.isPending;
  const busy = machine.stage === 'uploading' || machine.stage === 'validating' || confirming;

  function resetToIdle() {
    abortRef.current?.abort();
    abortRef.current = null;
    setFileRejectError(null);
    setMachine(INITIAL_MACHINE);
  }

  function handleCancelOrClose() {
    abortRef.current?.abort();
    abortRef.current = null;
    onClose();
  }

  function selectFile(file: File | undefined) {
    if (!file) return;
    if (!isCsvFile(file)) {
      setFileRejectError('Choose a .csv file. Only .csv files are supported.');
      return;
    }
    setFileRejectError(null);
    setMachine({
      ...INITIAL_MACHINE,
      stage: 'selected',
      file,
    });
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    selectFile(event.dataTransfer.files[0]);
  }

  async function startUploadAndValidation() {
    if (!machine.file) return;
    const file = machine.file;
    const controller = new AbortController();
    abortRef.current = controller;

    setMachine((prev) => ({
      ...prev,
      stage: 'uploading',
      progress: 0,
      failureMessage: null,
      endpointUnmounted: false,
    }));

    try {
      const result = await inventoryApi.validateCsvImport(file, {
        signal: controller.signal,
        onProgress: (percent) => {
          setMachine((prev) =>
            prev.stage === 'uploading' ? { ...prev, progress: percent } : prev,
          );
        },
        onValidating: () => {
          setMachine((prev) => ({ ...prev, stage: 'validating', progress: 100 }));
        },
      });
      if (controller.signal.aborted) return;

      if (result.errors.length > 0) {
        setMachine((prev) => ({
          ...prev,
          stage: 'errors',
          importId: result.importId,
          validRows: result.validRows,
          rowErrors: result.errors,
        }));
        return;
      }

      if (result.validRows.length === 0) {
        setMachine((prev) => ({
          ...prev,
          stage: 'errors',
          rowErrors: [
            { rowNumber: 1, sku: '—', message: 'The CSV file has no stock rows to import.' },
          ],
        }));
        return;
      }

      setMachine((prev) => ({
        ...prev,
        stage: 'ready',
        importId: result.importId,
        validRows: result.validRows,
        rowErrors: [],
      }));
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      const unmounted = isEndpointNotImplemented(caught);
      setMachine((prev) => ({
        ...prev,
        stage: 'failed',
        endpointUnmounted: unmounted,
        failureMessage: unmounted
          ? 'CSV stock import is not available on the server yet.'
          : presentError(caught).message,
      }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function handleConfirmImport() {
    if (machine.stage !== 'ready' || confirming) return;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await confirmMutation.mutateAsync({
        input: { importId: machine.importId, rows: machine.validRows },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const count = result.updatedCount;
      const productWord = count === 1 ? 'product' : 'products';
      setMachine((prev) => ({
        ...prev,
        stage: 'complete',
        updatedCount: count,
      }));
      notify({
        title: 'Stock imported',
        description: `Updated available stock for ${countFormat.format(count)} ${productWord}.`,
      });
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      const unmounted = isEndpointNotImplemented(caught);
      setMachine((prev) => ({
        ...prev,
        stage: 'failed',
        endpointUnmounted: unmounted,
        failureMessage: unmounted
          ? 'CSV stock import is not available on the server yet.'
          : presentError(caught).message,
      }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function renderActions() {
    switch (machine.stage) {
      case 'idle':
        return (
          <>
            <button
              type="button"
              data-dialog-safe
              onClick={handleCancelOrClose}
              className={dialogSecondaryClass}
            >
              Cancel
            </button>
            <button type="button" disabled className={dialogPrimaryClass}>
              Upload file
            </button>
          </>
        );
      case 'selected':
        return (
          <>
            <button
              type="button"
              data-dialog-safe
              onClick={handleCancelOrClose}
              className={dialogSecondaryClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void startUploadAndValidation()}
              className={dialogPrimaryClass}
            >
              Upload file
            </button>
          </>
        );
      case 'uploading':
        return (
          <>
            <button
              type="button"
              data-dialog-safe
              onClick={handleCancelOrClose}
              className={dialogSecondaryClass}
            >
              Cancel
            </button>
            <button type="button" disabled className={dialogPrimaryClass}>
              <Spinner />
              Uploading…
            </button>
          </>
        );
      case 'validating':
        return (
          <>
            <button
              type="button"
              data-dialog-safe
              onClick={handleCancelOrClose}
              className={dialogSecondaryClass}
            >
              Cancel
            </button>
            <button type="button" disabled className={dialogPrimaryClass}>
              <Spinner />
              Validating…
            </button>
          </>
        );
      case 'errors':
        return (
          <>
            <button
              type="button"
              data-dialog-safe
              onClick={handleCancelOrClose}
              className={dialogSecondaryClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                resetToIdle();
                inputRef.current?.click();
              }}
              className={dialogPrimaryClass}
            >
              Choose another file
            </button>
          </>
        );
      case 'ready':
        return (
          <>
            <button
              type="button"
              data-dialog-safe
              disabled={confirming}
              onClick={handleCancelOrClose}
              className={dialogSecondaryClass}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={confirming}
              onClick={() => void handleConfirmImport()}
              className={dialogPrimaryClass}
            >
              {confirming ? <Spinner /> : null}
              Confirm import
            </button>
          </>
        );
      case 'complete':
        return (
          <>
            <button type="button" onClick={resetToIdle} className={dialogSecondaryClass}>
              Import another file
            </button>
            <button type="button" data-dialog-safe onClick={onClose} className={dialogPrimaryClass}>
              Done
            </button>
          </>
        );
      case 'failed':
        return (
          <>
            <button
              type="button"
              data-dialog-safe
              onClick={handleCancelOrClose}
              className={dialogSecondaryClass}
            >
              Cancel
            </button>
            {machine.endpointUnmounted ? (
              <button type="button" onClick={onClose} className={dialogPrimaryClass}>
                Close
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startUploadAndValidation()}
                className={dialogPrimaryClass}
              >
                Try again
              </button>
            )}
          </>
        );
    }
  }

  const fileName = machine.file?.name ?? 'supplier-stock.csv';

  return (
    <Dialog
      open={open}
      title="Import stock from CSV"
      description="Choose a CSV file to review before importing."
      size="xl"
      sheetOnMobile
      hideIcon
      showCloseButton
      closeLabel="Close CSV import dialog"
      returnFocusTo={returnFocusTo}
      closeLocked={confirming}
      onClose={() => {
        if (!confirming) handleCancelOrClose();
      }}
      actions={renderActions()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Choose CSV file"
        disabled={busy}
        onChange={onFileInputChange}
      />

      {machine.stage === 'idle' ? (
        <div className="flex flex-col gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2.5 rounded-ws-card border border-dashed px-6 py-9 text-center transition-colors',
              fileRejectError
                ? 'border-danger'
                : dragOver
                  ? 'border-primary bg-primary-tint'
                  : 'border-line bg-surface hover:border-primary/60',
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-primary-tint text-primary"
            >
              <DashboardIcon name="upload" className="size-6" />
            </span>
            <p className="text-[length:var(--text-ws-body)] font-semibold text-ink">
              {dragOver ? 'Drop your CSV file here' : 'Drag and drop your CSV file'}
            </p>
            {!dragOver ? (
              <p className="text-[length:var(--text-ws-body)] text-subtle">
                or{' '}
                <span className="font-semibold text-primary underline underline-offset-2">
                  Browse file
                </span>
              </p>
            ) : null}
            <p className="text-[length:var(--text-ws-caption)] text-caption">.csv files only</p>
          </div>
          {fileRejectError ? <InlineError>{fileRejectError}</InlineError> : null}
          <p className="text-[length:var(--text-ws-caption)] leading-5 text-caption">
            {RESERVED_NOTE}
          </p>
        </div>
      ) : null}

      {machine.stage === 'selected' ? (
        <div className="flex flex-col gap-3">
          <FileRow
            fileName={fileName}
            caption="File selected · Ready to upload"
            onClear={resetToIdle}
          />
          <p className="text-[length:var(--text-ws-caption)] leading-5 text-caption">
            {RESERVED_NOTE}
          </p>
        </div>
      ) : null}

      {machine.stage === 'uploading' ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <FileRow
            fileName={fileName}
            caption={`Uploading… ${machine.progress}%`}
            progress={machine.progress}
          />
          <p className="text-[length:var(--text-ws-caption)] leading-5 text-caption">
            {RESERVED_NOTE}
          </p>
        </div>
      ) : null}

      {machine.stage === 'validating' ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <FileRow fileName={fileName} caption="Validating rows before import…" progress={100} />
          <p className="text-[length:var(--text-ws-caption)] leading-5 text-caption">
            {RESERVED_NOTE}
          </p>
        </div>
      ) : null}

      {machine.stage === 'errors' ? (
        <div className="flex flex-col gap-3" role="alert">
          <FileRow
            fileName={fileName}
            caption="Validation errors found · Import blocked"
            tone="danger"
          />
          <div className="rounded-ws-card border border-danger/30 bg-danger-tint p-4">
            <p className="text-[length:var(--text-ws-body)] font-semibold text-danger">
              {machine.rowErrors.length === 1
                ? '1 row has an error'
                : `${countFormat.format(machine.rowErrors.length)} rows have errors`}
            </p>
            <p className="mt-0.5 text-[length:var(--text-ws-caption)] text-danger">
              Fix these rows in your CSV file and upload again. No stock was changed.
            </p>
            <ul className="mt-3 flex max-h-40 flex-col gap-1.5 overflow-y-auto text-[length:var(--text-ws-caption)] text-danger">
              {machine.rowErrors.map((err, idx) => (
                <li key={`${err.rowNumber}-${err.sku}-${idx}`}>
                  <span className="font-semibold">
                    Row {err.rowNumber} ({err.sku}):
                  </span>{' '}
                  {err.message}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[length:var(--text-ws-caption)] text-caption">
            Reserved stock is system-managed and cannot be changed here.
          </p>
        </div>
      ) : null}

      {machine.stage === 'ready' ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <FileRow
            fileName={fileName}
            caption="Validation passed · Ready to import"
            tone="success"
          />
          <div className="rounded-ws-card border border-line bg-canvas p-4">
            <p className="text-[length:var(--text-ws-body)] font-semibold text-ink">
              Ready to update {countFormat.format(machine.validRows.length)}{' '}
              {machine.validRows.length === 1 ? 'product' : 'products'}
            </p>
            <p className="mt-0.5 text-[length:var(--text-ws-caption)] text-subtle">
              Review the stock quantities below before confirming.
            </p>
            <div className="mt-3 max-h-44 overflow-y-auto rounded-ws-control border border-line bg-surface">
              <table className="w-full text-left text-[length:var(--text-ws-caption)]">
                <thead>
                  <tr className="border-b border-line bg-canvas text-subtle">
                    <th scope="col" className="px-3 py-2 font-medium">
                      SKU
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Product
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      New stock
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {machine.validRows.map((row) => (
                    <tr key={row.sku} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-2 font-medium text-ink">{row.sku}</td>
                      <td className="truncate px-3 py-2 text-subtle">{row.productName ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-ink">
                        {countFormat.format(row.availableQuantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[length:var(--text-ws-caption)] text-caption">
            Reserved stock is system-managed and cannot be changed here.
          </p>
        </div>
      ) : null}

      {machine.stage === 'complete' ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <div className="flex items-start gap-3 rounded-ws-card border border-success/30 bg-success-tint p-4">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-success"
            >
              <DashboardIcon name="check-circle" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[length:var(--text-ws-body)] font-semibold text-ink">
                Stock import complete
              </p>
              <p className="mt-0.5 text-[length:var(--text-ws-caption)] text-subtle">
                Updated available stock for {countFormat.format(machine.updatedCount)}{' '}
                {machine.updatedCount === 1 ? 'product' : 'products'}.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {machine.stage === 'failed' ? (
        <div className="flex flex-col gap-3" role="alert">
          <FileRow fileName={fileName} caption="Import did not complete" tone="danger" />
          <div className="flex items-start gap-3 rounded-ws-card border border-danger/30 bg-danger-tint p-4 text-danger">
            <DashboardIcon name="alert" className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[length:var(--text-ws-body)] font-semibold">Import failed</p>
              <p className="mt-0.5 text-[length:var(--text-ws-caption)]">
                {machine.failureMessage ?? 'We could not process this CSV file. Try again.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
