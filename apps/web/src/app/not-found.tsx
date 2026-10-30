import type { Metadata } from 'next';
import { NotFoundPage } from '@/components/errors/NotFoundPage';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page does not exist on Sellonit.',
};

/** Custom 404 for any unknown URL. */
export default function RootNotFound() {
  return (
    <NotFoundPage description="We couldn't find the page you were looking for. Check the address and try again." />
  );
}
