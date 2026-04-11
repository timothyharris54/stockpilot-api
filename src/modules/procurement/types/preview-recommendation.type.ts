import { Prisma } from '@prisma/client';

export interface PreviewRecommendation {
  recommendationId: bigint;
  productId: bigint;
  productName: string;
  productSku: string;
  vendorId: bigint;
  vendorProductId: bigint;
  recommendedQty: Prisma.Decimal;
  finalQty: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
}
