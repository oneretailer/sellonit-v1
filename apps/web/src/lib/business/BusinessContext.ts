'use client';

import { createContext } from 'react';
import type { SwitcherBusiness } from './businessesApi';

export type BusinessPermission =
  | 'product:read'
  | 'product:write'
  | 'product:publish'
  | 'product:delete';

export type BusinessContextValue = {
  businesses: SwitcherBusiness[];
  activeBusiness: SwitcherBusiness | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  switchBusiness: (id: string) => void;
  switcherOpen: boolean;
  setSwitcherOpen: (open: boolean) => void;
  can: (permission: BusinessPermission) => boolean;
};

export const BusinessContext = createContext<BusinessContextValue | null>(null);
