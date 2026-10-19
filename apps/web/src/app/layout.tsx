import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * Poppins is exposed as the CSS variable `--font-poppins`. It is set on <html>
 * (not <body>) because `--font-sans` in `@theme` references it, and a `var()`
 * in a custom property resolves on the element that declares it. <body> then
 * uses `font-sans`, which is Poppins everywhere.
 */
export const metadata: Metadata = {
  title: {
    default: 'Sellonit',
    template: '%s — Sellonit',
  },
  description: 'Sellonit — virtual-inventory commerce and supply-chain platform.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
