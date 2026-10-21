import Image from 'next/image';

export const BAG_MARK_SIZE_CLASS = 'w-9 md:w-12 2xl:w-14';

export type BagMarkProps = {
  className?: string;
  /** Pass only if the mark conveys meaning. Omit for a decorative icon. */
  title?: string;
};

/**
 * Brand bag mark. To change the artwork, replace public/shopping-bag.svg.
 * Size it with classes; the default is shared by every auth screen.
 */
export function BagMark({  title }: BagMarkProps) {
  return (
    <Image
      src="/shopping-bag.svg"
      width={56}
      height={60}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      className={`h-auto w-[74px] `}
      priority
    />
  );
}