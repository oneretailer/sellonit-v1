export type AccountRole = 'entrepreneur' | 'retailer' | 'supplier';

export type RoleOption = {
  id: AccountRole;
  label: string;
  recommendationKey: AccountRole;
};

/** Role labels are product copy; IDs are onboarding preferences, not backend permissions. */
export const ROLE_OPTIONS = [
  {
    id: 'entrepreneur',
    label: 'I want to sell products online without buying inventory upfront',
    recommendationKey: 'entrepreneur',
  },
  {
    id: 'retailer',
    label: 'I want to manage my own products, inventory, and online store',
    recommendationKey: 'retailer',
  },
  {
    id: 'supplier',
    label:
      'I manufacture or supply products and want to reach more retailers and scale my business',
    recommendationKey: 'supplier',
  },
] as const satisfies readonly RoleOption[];

export function isAccountRole(value: unknown): value is AccountRole {
  return value === 'entrepreneur' || value === 'retailer' || value === 'supplier';
}
