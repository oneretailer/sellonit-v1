import type { Metadata } from 'next';
import { DashboardRoute } from '@/components/dashboard/DashboardRoute';

export const metadata: Metadata = {
  title: 'Dashboard coming soon',
  description: 'Your Sellonit workspace is coming soon.',
};

export default function DashboardComingSoonPage() {
  return <DashboardRoute mode="coming-soon" />;
}
