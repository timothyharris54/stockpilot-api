import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { adjustToPurchasingConstraints } from '../utils/purchasing-quantity.util';
import { Prisma, RecommendationStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { VendorProductSelectorService } from 'src/modules/procurement/services/vendor-product-selector.service';
import { ResolvedRecommendation } from 'src/modules/procurement/types/resolved-recommendation.type';
import { ConversionSummary } from 'src/modules/procurement/types/conversion-summary.type';
import { PreviewRecommendation } from 'src/modules/procurement/types/preview-recommendation.type';
import { ConversionPreviewSummary } from '../types/conversion-preview-summary.type';

type ConvertibleRecommendationStatus = 'open' | 'reviewed';

type ConvertRecommendationsInput = {
  accountId: bigint;
  recommendationIds: string[];
};

@Injectable()
export class RecommendationConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorProductSelector: VendorProductSelectorService,
  ) {}

async convertRecommendations(
  input: ConvertRecommendationsInput,
): Promise<ConversionSummary> {
  const accountId = input.accountId;

  const resolvedRecommendations = await this.resolveRecommendationsForConversion(
    accountId,
    input.recommendationIds,
  );

  const groupedByVendor = this.groupByVendor(resolvedRecommendations);

  return this.prisma.$transaction(async (tx) => {
    const summary: ConversionSummary = {
      createdPurchaseOrders: 0,
      convertedRecommendations: 0,
      purchaseOrders: [],
    };

    for (const [vendorIdKey, items] of groupedByVendor.entries()) {
      const vendorId = BigInt(vendorIdKey);

      const poNumber = await this.generatePoNumber(tx, accountId);

      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          accountId,
          vendorId,
          poNumber,
          status: 'draft',
        },
      });

      let totalOrderedQty = new Prisma.Decimal(0);
      let totalCost = new Prisma.Decimal(0);
      let lineCount = 0;

      for (const item of items) {
        const lineTotal =
          item.unitCost !== null ? item.unitCost.mul(item.finalQty) : null;

        const purchaseOrderLine = await tx.purchaseOrderLine.create({
          data: {
            accountId,
            purchaseOrderId: purchaseOrder.id,
            productId: item.productId,
            vendorProductId: item.vendorProductId,
            orderedQty: item.finalQty,
            unitCost: item.unitCost,
            lineTotal,
          },
        });

        const updateResult = await tx.reorderRecommendation.updateMany({
          where: {
            accountId,
            id: item.recommendationId,
            status: { in: ['open', 'reviewed'] },
            purchaseOrderId: null,
            purchaseOrderLineId: null,
          },
          data: {
            status: RecommendationStatus.converted,
            vendorId: item.vendorId,
            vendorProductId: item.vendorProductId,
            purchaseOrderId: purchaseOrder.id,
            purchaseOrderLineId: purchaseOrderLine.id,
            finalQty: item.finalQty,
            convertedAt: new Date(),
          },
        });

        if (updateResult.count !== 1) {
          throw new BadRequestException(
            `Recommendation ${item.recommendationId.toString()} could not be converted due to a concurrent update or invalid state.`,
          );
        }

        lineCount += 1;
        totalOrderedQty = totalOrderedQty.add(item.finalQty);

        if (lineTotal) {
          totalCost = totalCost.add(lineTotal);
        }
      }

      summary.createdPurchaseOrders += 1;
      summary.convertedRecommendations += items.length;
      summary.purchaseOrders.push({
        purchaseOrderId: purchaseOrder.id.toString(),
        vendorId: vendorId.toString(),
        lineCount,
        totalOrderedQty: totalOrderedQty.toString(),
        totalCost: totalCost.toFixed(2),
      });
    }

    return summary;
  });
}
async previewRecommendations(
  input: ConvertRecommendationsInput,
): Promise<ConversionPreviewSummary> {
  const resolvedRecommendations = await this.resolveRecommendationsForConversion(
    input.accountId,
    input.recommendationIds,
  );

  const groupedByVendor = this.groupByVendor(resolvedRecommendations);

  const vendorGroups = Array.from(groupedByVendor.entries()).map(
    ([vendorId, items]) => {
      let totalOrderedQty = new Prisma.Decimal(0);
      let totalCost = new Prisma.Decimal(0);

      const lines = items.map((item) => {
        const lineTotal =
          item.unitCost !== null ? item.unitCost.mul(item.finalQty) : null;

        totalOrderedQty = totalOrderedQty.add(item.finalQty);

        if (lineTotal) {
          totalCost = totalCost.add(lineTotal);
        }

        return {
          recommendationId: item.recommendationId.toString(),
          productId: item.productId.toString(),
          vendorProductId: item.vendorProductId.toString(),
          recommendedQty: item.recommendedQty.toString(),
          finalQty: item.finalQty.toString(),
          unitCost: item.unitCost ? item.unitCost.toString() : null,
          lineTotal: lineTotal ? lineTotal.toFixed(2) : null,
        };
      });

      return {
        vendorId,
        lineCount: items.length,
        totalOrderedQty: totalOrderedQty.toString(),
        totalCost: totalCost.toFixed(2),
        lines,
      };
    },
  );

  return {
    vendorGroups,
    totalGroups: vendorGroups.length,
    totalRecommendations: vendorGroups.reduce(
      (sum, group) => sum + group.lineCount,
      0,
    ),
  };
}
  private async resolveRecommendationsForConversion(
    accountId: bigint,
    recommendationIdsInput: string[],
  ): Promise<ResolvedRecommendation[]> {
    const recommendations = await this.findConvertibleRecommendations(
      accountId,
      recommendationIdsInput,
    );

    return Promise.all(
      recommendations.map((recommendation) =>
        this.resolveRecommendationForConversion(accountId, recommendation),
      ),
    );
  }

  private async resolveRecommendationForConversion(
    accountId: bigint,
    recommendation: {
      id: bigint;
      productId: bigint;
      recommendedQty: Prisma.Decimal;
    },
  ): Promise<ResolvedRecommendation> {
    const vendorProducts = await this.prisma.vendorProduct.findMany({
      where: {
        accountId,
        productId: recommendation.productId,
        isActive: true,
      },
      orderBy: [
        { isPrimaryVendor: 'desc' },
        { id: 'asc' },
      ],
    });

    const selectedVendorProduct = this.vendorProductSelector.select(vendorProducts);

    if (!selectedVendorProduct) {
      throw new BadRequestException(
        `Unable to resolve a vendor product for recommendation ${recommendation.id.toString()} (product ${recommendation.productId.toString()}).`,
      );
    }

    const finalQty = adjustToPurchasingConstraints(
      recommendation.recommendedQty,
      selectedVendorProduct.minOrderQty,
      selectedVendorProduct.orderMultiple,
    );

    if (finalQty.lte(0)) {
      throw new BadRequestException(
        `Calculated final quantity must be greater than zero for recommendation ${recommendation.id.toString()}.`,
      );
    }

    return {
      recommendationId: recommendation.id,
      productId: recommendation.productId,
      vendorId: selectedVendorProduct.vendorId,
      vendorProductId: selectedVendorProduct.id,
      recommendedQty: recommendation.recommendedQty,
      finalQty,
      unitCost: selectedVendorProduct.unitCost,
    };
  }

  private parseRecommendationIds(ids: string[]): bigint[] {
    const parsed = ids.map((id) => {
      try {
        return BigInt(id);
      } catch {
        throw new BadRequestException(`Invalid recommendationId: ${id}`);
      }
    });

    const unique = new Set(parsed.map((id) => id.toString()));
    if (unique.size !== parsed.length) {
      throw new BadRequestException('Duplicate recommendationIds are not allowed.');
    }

    return parsed;
  }

  private groupByVendor(
    items: ResolvedRecommendation[],
  ): Map<string, ResolvedRecommendation[]> {
    const grouped = new Map<string, ResolvedRecommendation[]>();

    for (const item of items) {
      const key = item.vendorId.toString();
      const existing = grouped.get(key);

      if (existing) {
        existing.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }

    return grouped;
  }

  private async findConvertibleRecommendations(
    accountId: bigint,
    recommendationIdsInput: string[],
  ): Promise<
    Array<{
      id: bigint;
      productId: bigint;
      recommendedQty: Prisma.Decimal;
    }>
  > {
    const recommendationIds = this.parseRecommendationIds(recommendationIdsInput);

    if (recommendationIds.length === 0) {
      throw new BadRequestException('At least one recommendationId is required.');
    }

    const recommendations = await this.prisma.reorderRecommendation.findMany({
      where: {
        accountId,
        id: { in: recommendationIds },
        status: { in: ['open', 'reviewed'] satisfies ConvertibleRecommendationStatus[] },
      },
      select: {
        id: true,
        productId: true,
        recommendedQty: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    if (recommendations.length !== recommendationIds.length) {
      throw new NotFoundException(
        'One or more recommendations were not found, do not belong to this account, or are not convertible.',
      );
    }

    return recommendations;
  }  

  /**
   * Simple v1 PO number generator.
   * Replace later with a stronger sequence strategy if needed.
   */
  private async generatePoNumber(
    tx: Prisma.TransactionClient,
    accountId: bigint,
  ): Promise<string> {
    const count = await tx.purchaseOrder.count({
      where: { accountId },
    });

    const nextNumber = count + 1;
    return `PO-${nextNumber.toString().padStart(6, '0')}`;
  }
}
