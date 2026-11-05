'use client';

/**
 * Header business switcher: the only switcher entry point. Popover on sm+,
 * bottom sheet below sm. Keyboard: arrows move focus, Enter selects, Escape
 * closes and returns focus to the pill. Selecting another business while the
 * product form is dirty routes through the shared NavigationGuard dialog.
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { DashboardIcon } from './icons';
import { useBusiness } from '@/lib/business/BusinessProvider';
import { businessPlanLabel, businessRoleLabel, businessTypeLabel } from '@/lib/business/businessesApi';
import { useOptionalNavigationGuard } from '@/components/workspace/NavigationGuard';

const FALLBACK_BUSINESS_NAME = 'Your business';

export function BusinessSwitcher() {
  const { businesses, activeBusiness, switcherOpen, setSwitcherOpen, switchBusiness } = useBusiness();
  const guard = useOptionalNavigationGuard();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const name = activeBusiness?.name ?? FALLBACK_BUSINESS_NAME;

  useEffect(() => {
    if (!switcherOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setSwitcherOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSwitcherOpen(false);
        pillRef.current?.focus();
        return;
      }
      if (!menuRef.current) return;
      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        items[0]?.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        items.at(-1)?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // Focus the active business row when the menu opens.
    const frame = requestAnimationFrame(() => {
      const active = menuRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
      const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      (active ?? first)?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [switcherOpen, setSwitcherOpen]);

  function select(id: string) {
    if (id === activeBusiness?.id) { setSwitcherOpen(false); return; }
    const target = businesses.find((business) => business.id === id);
    const run = () => switchBusiness(id);
    if (guard) {
      guard.runGuarded({
        title: 'Switch business?',
        description: `You have unsaved product details. If you switch to ${target?.name ?? 'another business'}, they won't be kept.`,
        discardLabel: 'Switch business',
        keepLabel: 'Stay here',
        run,
      });
    } else {
      run();
    }
  }

  function addBusiness() {
    setSwitcherOpen(false);
    const target = '/auth/create-business?mode=add';
    if (guard) guard.navigate(target);
    else router.push(target);
  }

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button
        ref={pillRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={switcherOpen}
        aria-label={`Switch business, current: ${name}`}
        onClick={() => setSwitcherOpen(!switcherOpen)}
        className="flex min-h-11 max-w-full items-center gap-2 rounded-full border border-line bg-white px-3 text-sm font-medium text-ink transition-colors hover:border-primary/60 sm:px-4"
      >
        <DashboardIcon name="business" className="size-4 shrink-0 text-subtle" />
        <span className="hidden max-w-28 truncate min-[420px]:inline sm:max-w-48">{name}</span>
        <DashboardIcon name="chevron-down" className={cn('size-4 shrink-0 text-subtle transition-transform', switcherOpen && 'rotate-180')} />
      </button>

      {switcherOpen ? (
        <>
          {/* Backdrop only for the small-screen bottom sheet. */}
          <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" role="presentation" onMouseDown={() => { setSwitcherOpen(false); pillRef.current?.focus(); }} />
          <div
            ref={menuRef}
            role="menu"
            aria-label="Your businesses"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-3xl border border-line bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:bottom-auto sm:z-50 sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:p-2 sm:pb-2"
          >
            <p className="px-2 py-2 text-xs font-medium text-subtle">Your businesses</p>
            <div className={cn('flex flex-col', businesses.length > 6 && 'max-h-80 overflow-y-auto')}>
              {businesses.length === 0 ? (
                <p className="px-2 py-3 text-sm text-subtle">No businesses yet.</p>
              ) : businesses.map((business) => {
                const active = business.id === activeBusiness?.id;
                return (
                  <button
                    key={business.id}
                    type="button"
                    role="menuitem"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => select(business.id)}
                    className={cn('flex min-h-12 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-orange-50', active && 'bg-orange-50/60')}
                  >
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-subtle">
                      <DashboardIcon name="business" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{business.name}</span>
                      <span className="block truncate text-xs text-subtle">
                        {businessTypeLabel(business.type)} · {businessRoleLabel(business.role)}
                        {businessPlanLabel(business.plan) ? ` · ${businessPlanLabel(business.plan)}` : ''}
                        {business.status === 'SUSPENDED' ? ' · Suspended' : ''}
                      </span>
                    </span>
                    {active ? (
                      <span aria-hidden="true" className="text-primary"><DashboardIcon name="check-circle" className="size-5" /></span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 border-t border-line pt-2">
              <button type="button" role="menuitem" onClick={addBusiness} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium text-ink transition-colors hover:bg-orange-50">
                <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg bg-orange-50 text-primary"><DashboardIcon name="plus" className="size-4" /></span>
                Add business
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
