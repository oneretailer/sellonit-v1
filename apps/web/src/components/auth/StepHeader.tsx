import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/cn';

export type AuthCardHeaderProps = {
  title: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  align?: 'center' | 'left';
  headingRef?: Ref<HTMLHeadingElement>;
  headingTabIndex?: number;
  /** Extra classes for the header wrapper (e.g. `md:text-left` on login). */
  className?: string;
  /** Extra classes for the icon wrapper (e.g. `md:hidden` to drop artwork at md+). */
  iconClassName?: string;
};

/** Heading group shared by auth cards; optional artwork is provided by the screen. */
export function AuthCardHeader({
  title,
  children,
  icon,
  align = 'center',
  headingRef,
  headingTabIndex,
  className,
  iconClassName,
}: AuthCardHeaderProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col',
        align === 'left' ? 'text-left' : 'text-center',
        className,
      )}
    >
      {icon ? (
        <div className={cn('mb-4 flex w-full justify-center md:mb-6', iconClassName)}>{icon}</div>
      ) : null}
      <div className="flex w-full flex-col gap-2">
        <h1 ref={headingRef} tabIndex={headingTabIndex} className="auth-heading">
          {title}
        </h1>
        {children ? <p className="text-base text-subtle sm:text-lg">{children}</p> : null}
      </div>
    </div>
  );
}

/** Backwards-compatible name for existing auth screens. */
export const StepHeader = AuthCardHeader;
