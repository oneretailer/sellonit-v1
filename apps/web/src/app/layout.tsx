import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * Poppins is exposed as the CSS variable `--font-poppins`. It is set on <html>
 * (not <body>) because `--font-sans` in `@theme` references it, and a `var()`
 * in a custom property resolves on the element that declares it. <body> then
 * uses `font-sans`, which is Poppins everywhere.
 */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Sellonit',
    template: '%s — Sellonit',
  },
  description: 'Sellonit — virtual-inventory commerce and supply-chain platform.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
