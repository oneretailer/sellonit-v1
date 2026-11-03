import type { ReactNode } from 'react';
import { Navbar, type NavbarLink } from './Navbar';

export type AuthPageProps = {
  children: ReactNode;
  rightLink?: NavbarLink;
};

/**
 * Full-screen page shell: the navbar at the top, and the content (an AuthCard)
 * centred horizontally in the area below it. From `md` up the card is also
 * centred vertically when there is spare room, using safe alignment so a card
 * taller than the viewport aligns to the top and the page scrolls (never
 * clipped). `min-h-dvh` tracks the dynamic viewport on mobile browsers.
 */
export function AuthPage({ children, rightLink }: AuthPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas md:min-h-dvh">
      <Navbar rightLink={rightLink} />
      <main className="flex flex-1 items-start justify-center px-0 pt-8 pb-12 sm:px-6 sm:pt-16 md:items-center-safe md:py-8">
        {children}
      </main>
    </div>
  );
}
