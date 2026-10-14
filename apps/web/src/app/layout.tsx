import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { RegistrationFlow } from '@/components/auth/RegistrationFlow';

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
      <body>
        <RegistrationFlow>{children}</RegistrationFlow>
      </body>
    </html>
  );
}
