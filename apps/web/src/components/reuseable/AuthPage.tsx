import type { ReactNode } from 'react';
import { Navbar, type NavbarLink } from './Navbar';

export type AuthPageProps = {
  children: ReactNode;
  rightLink?: NavbarLink;
};

/**
 * Full-screen page shell: the navbar at the top, and the content (an AuthCard)
 * centred horizontally and vertically in the area below it.
 */
export function AuthPage({ children, rightLink }: AuthPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar rightLink={rightLink} />
      <main className="flex flex-1 items-start justify-center px-0 pt-8 pb-12 sm:px-6 sm:pt-16">
        {children}
      </main>
    </div>
  );
}
