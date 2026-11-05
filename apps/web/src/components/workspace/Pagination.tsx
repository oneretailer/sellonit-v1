import type { Pagination as PaginationMeta } from '@/lib/workspace/types';
import { SecondaryButton } from '@/components/reuseable/SecondaryButton';

export function Pagination({ meta, onPageChange, disabled = false }: { meta: PaginationMeta; onPageChange: (page: number) => void; disabled?: boolean }) {
  return <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-subtle">
    <p aria-live="polite">{meta.total} items · Page {meta.page} of {Math.max(1, meta.totalPages)}</p>
    <div className="flex gap-2"><SecondaryButton appearance="outline" shape="rounded" className="w-auto px-4 text-sm" disabled={disabled || meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>Previous</SecondaryButton><SecondaryButton appearance="outline" shape="rounded" className="w-auto px-4 text-sm" disabled={disabled || meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>Next</SecondaryButton></div>
  </nav>;
}
