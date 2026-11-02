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

/* ── Recommendation screen content ─────────────────────────────────────── */

/** Icon keys rendered by RoleRecommendation (thin dark outline icons). */
export type RoleBulletIcon = 'box' | 'tag' | 'storefront' | 'bag';

export type RoleRecommendationContent = {
  /** Display name interpolated into the copy ("Continue as a Retailer"). */
  name: string;
  /** Subtitle sentence; `{role}` is replaced with `name`. */
  subtitle: string;
  /** Heading of the inner detail card. */
  heading: string;
  bullets: readonly { icon: RoleBulletIcon; text: string }[];
  /** Copy for the dashboard this role opens today (see PLACEHOLDER note). */
  dashboard: string;
};

/**
 * Copy for the recommendation screen, one entry per onboarding role.
 *
 * The Retailer variant is the supplied design copy. Supplier and entrepreneur
 * copy is placeholder product copy written for this build — see the report so
 * it can be replaced with approved wording.
 */
export const ROLE_RECOMMENDATIONS: Record<AccountRole, RoleRecommendationContent> = {
  retailer: {
    name: 'Retailer',
    subtitle: 'Based on your answers, the Retailer role is the best fit for your business.',
    heading: 'What you can do as a retailer',
    bullets: [
      { icon: 'box', text: 'Discover products from suppliers.' },
      { icon: 'tag', text: 'Set your selling prices and earn a margin.' },
      { icon: 'storefront', text: 'Create your own online storefront.' },
      { icon: 'bag', text: 'Sell products to customers without holding inventory.' },
    ],
    dashboard:
      'Your retailer dashboard is still being built. Supplier tools are the first workspace available.',
  },
  supplier: {
    name: 'Supplier',
    subtitle: 'Based on your answers, the Supplier role is the best fit for your business.',
    heading: 'What you can do as a supplier',
    bullets: [
      { icon: 'box', text: 'List your products for retailers to discover and sell.' },
      { icon: 'tag', text: 'Set wholesale prices and stay in control of your margins.' },
      { icon: 'storefront', text: 'Showcase your catalogue to a wider network of retailers.' },
      { icon: 'bag', text: 'Fulfil retailer orders without running a storefront yourself.' },
    ],
    dashboard: 'Your supplier workspace is ready. Track orders and stock from your overview.',
  },
  entrepreneur: {
    name: 'Entrepreneur',
    subtitle: 'Based on your answers, the Entrepreneur role is the best fit for your business.',
    heading: 'What you can do as an entrepreneur',
    bullets: [
      { icon: 'box', text: 'Start selling without buying inventory upfront.' },
      { icon: 'tag', text: 'Choose your prices and grow your margin.' },
      { icon: 'storefront', text: 'Launch a storefront in minutes.' },
      { icon: 'bag', text: 'Sell to customers while suppliers hold the stock.' },
    ],
    dashboard:
      'Your entrepreneur dashboard is still being built. Supplier tools are the first workspace available.',
  },
};

export function roleRecommendationContent(role: AccountRole): RoleRecommendationContent {
  return ROLE_RECOMMENDATIONS[role];
}

export function isSupplierRole(role: AccountRole | null): boolean {
  return role === 'supplier';
}
