'use client';

/**
 * The "···" row menu: Publish/Unpublish + Delete. Keyboard: Enter/Space opens
 * (native button), arrows cycle items, Escape closes and refocuses the
 * trigger, outside click closes.
 */
import { useEffect, useRef, useState } from 'react';
import { DashboardIcon } from '@/components/dashboard/icons';
import type { Product } from '@/lib/products/types';

export function ProductRowMenu({
  product,
  onTogglePublish,
  onDelete,
  disabled = false,
}: {
  product: Product;
  onTogglePublish: (product: Product) => void;
  onDelete: (product: Product) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (!open || !menuRef.current) return;
    const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    }
  }

  return (
    <div className="relative" ref={containerRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${product.name}`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex size-9 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-gray-50 hover:text-ink disabled:opacity-50"
      >
        <DashboardIcon name="dots" className="size-5" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${product.name}`}
          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-line bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { close(); onTogglePublish(product); }}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-ink transition-colors hover:bg-gray-50"
          >
            <DashboardIcon name={product.status === 'published' ? 'box' : 'check-circle'} className="size-4 text-subtle" />
            {product.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { close(false); onDelete(product); }}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-danger transition-colors hover:bg-red-50"
          >
            <DashboardIcon name="trash" className="size-4" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
