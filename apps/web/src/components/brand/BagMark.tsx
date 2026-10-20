import Image from 'next/image';

export type BagMarkProps = {
  className?: string;
  /** Pass only if the mark conveys meaning. Omit for a decorative icon. */
  title?: string;
};

/**
 * Brand bag mark. To change the artwork, replace public/shopping-bag.svg.
 * Size it with classes, e.g. className="w-9 sm:w-14".
 */
export function BagMark({ className = 'w-[72px] sm:w-14', title }: BagMarkProps) {
  return (
    <Image
      src="/shopping-bag.svg"
      width={72}
      height={72}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      className={`h-auto w-[72px]  ${className}`}
      priority
    />
  );
}