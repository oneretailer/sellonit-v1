type ProductWithRelations = {
  id: string;
  businessId: string;
  name: string;
  description: string;
  category: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  variants: Array<{ sku: string; basePriceKobo: bigint }>;
  pricingRule: { maxMarkupKobo: bigint | null } | null;
};

export function productResponse(product: ProductWithRelations) {
  const variant = product.variants[0];
  return {
    id: product.id,
    businessId: product.businessId,
    name: product.name,
    description: product.description,
    category: product.category,
    defaultVariant: {
      sku: variant?.sku ?? '',
      basePriceKobo: Number(variant?.basePriceKobo ?? 0n),
    },
    status: product.status,
    pricingRule: { maxMarkupKobo: product.pricingRule?.maxMarkupKobo ?? null },
    publishedAt: product.publishedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
