/**
 * Huge, faint bag mark behind the auth card. Decorative only.
 * Shown from 2xl (1536px) up. To change the artwork, replace
 * public/shopping-bag.svg. To make it fainter or stronger, edit the opacity.
 */
export function AuthBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden 2xl:block"
    >
      <div className="absolute top-1/2 left-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 bg-[url('/shopping-bag.svg')] bg-contain bg-center bg-no-repeat opacity-[0.06] min-[1920px]:size-[1100px]" />
    </div>
  );
}
