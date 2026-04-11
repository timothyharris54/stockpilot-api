import { Prisma } from '@prisma/client';

export interface ResolvedRecommendation {
  recommendationId: bigint;
  productId: bigint;
  vendorId: bigint;
  vendorProductId: bigint;
  recommendedQty: Prisma.Decimal;
  finalQty: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
};
