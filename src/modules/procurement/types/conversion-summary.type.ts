import { Prisma } from '@prisma/client';

export interface ConversionSummary {
  createdPurchaseOrders: number;
  convertedRecommendations: number;
  purchaseOrders: Array<{
    purchaseOrderId: string;
    vendorId: string;
    lineCount: number;
    totalOrderedQty: string;
    totalCost: string;
  }>;
};
