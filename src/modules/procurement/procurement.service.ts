import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  InventoryEventType,
  Prisma,
  PurchaseOrderStatus,
  ReferenceType,
} from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { InventoryBalanceService } from '../inventory/services/inventory-balance.service';

type PurchaseOrderInput = {
  accountId: bigint;
  createPurchaseOrderDto: CreatePurchaseOrderDto;
};

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly inventoryBalanceService: InventoryBalanceService,
  ) {}

  async createPurchaseOrder(input: PurchaseOrderInput) {
    const accountId = input.accountId;
    const createPurchaseOrderDto = input.createPurchaseOrderDto;
    const vendorId = BigInt(createPurchaseOrderDto.vendorId);
    const vendor = await this.prismaService.vendor.findFirst({
      where: { id: vendorId, accountId },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    for (const line of createPurchaseOrderDto.lines) {
      const productId = BigInt(line.productId);
      const product = await this.prismaService.product.findFirst({
        where: { id: productId, accountId },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }
      if (line.vendorProductId) {
        const existingVendorProduct =
          await this.prismaService.vendorProduct.findFirst({
            where: {
              id: BigInt(line.vendorProductId),
              accountId,
              vendorId,
              productId,
            },
          });
        if (!existingVendorProduct) {
          throw new BadRequestException(
            `Vendor product with ID ${line.vendorProductId} not found for product ${productId} and vendor ${vendorId}`,
          );
        }
      }
    }

    return this.prismaService.purchaseOrder.create({
      data: {
        accountId,
        vendorId,
        locationCode: createPurchaseOrderDto.locationCode,
        poNumber: createPurchaseOrderDto.poNumber,
        expectedAt: createPurchaseOrderDto.expectedAt
          ? new Date(createPurchaseOrderDto.expectedAt)
          : undefined,
        notes: createPurchaseOrderDto.notes,
        status: PurchaseOrderStatus.draft,
        lines: {
          create: createPurchaseOrderDto.lines.map((line) => {
            const orderdQty = new Prisma.Decimal(line.orderedQty);
            const unitCost = line.unitCost
              ? new Prisma.Decimal(line.unitCost)
              : undefined;

            return {
              accountId,
              productId: BigInt(line.productId),
              vendorProductId: line.vendorProductId
                ? BigInt(line.vendorProductId)
                : undefined,
              orderedQty: new Prisma.Decimal(line.orderedQty),
              unitCost: line.unitCost
                ? new Prisma.Decimal(line.unitCost)
                : undefined,
              lineTotal: unitCost ? orderdQty.mul(unitCost) : undefined,
            };
          }),
        },
      },
    });
  }

  async findAllPurchaseOrders(accountId: bigint) {
    return this.prismaService.purchaseOrder.findMany({
      where: { accountId },
      include: {
        vendor: true,
        lines: {
          include: {
            product: true,
            vendorProduct: true,
          },
        },
        receipts: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async findPurchaseOrder(accountId: bigint, purchaseOrderId: string) {
    let poId: bigint;

    try {
      poId = BigInt(purchaseOrderId);
    } catch {
      throw new BadRequestException('Invalid purchase order id');
    }

    const purchaseOrderDetail =
      await this.prismaService.purchaseOrder.findFirst({
        where: { id: poId, accountId },
        include: {
          vendor: true,
          lines: {
            include: {
              product: true,
              vendorProduct: true,
            },
          },
          receipts: {
            include: {
              lines: {
                include: {
                  product: true,
                },
              },
            },
            orderBy: {
              receivedAt: 'desc',
            },
          },
        },
      });

    if (!purchaseOrderDetail) {
      throw new NotFoundException(
        `Purchase order with ID ${purchaseOrderId} not found`,
      );
    }

    return purchaseOrderDetail;
  }

  async updatePurchaseOrder(
    accountId: bigint,
    purchaseOrderId: string,
    dto: UpdatePurchaseOrderDto,
  ) {
    let poId: bigint;

    try {
      poId = BigInt(purchaseOrderId);
    } catch {
      throw new BadRequestException('Invalid purchase order id');
    }

    if (
      dto.expectedAt === undefined &&
      dto.notes === undefined &&
      (!dto.lines || dto.lines.length === 0)
    ) {
      throw new BadRequestException('No purchase order updates provided');
    }

    const purchaseOrder = await this.prismaService.purchaseOrder.findFirst({
      where: { id: poId, accountId },
      select: {
        id: true,
        status: true,
        lines: {
          select: {
            id: true,
            receivedQty: true,
            unitCost: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(
        `Purchase order with ID ${purchaseOrderId} not found`,
      );
    }

    if (purchaseOrder.status !== PurchaseOrderStatus.draft) {
      throw new BadRequestException(
        'Only draft purchase orders can be updated',
      );
    }

    const lineIds = new Set<string>();
    const linesById = new Map<bigint, (typeof purchaseOrder.lines)[number]>();

    for (const line of purchaseOrder.lines) {
      linesById.set(line.id, line);
    }

    const parsedLines = (dto.lines ?? []).map((line) => {
      let lineId: bigint;

      try {
        lineId = BigInt(line.purchaseOrderLineId);
      } catch {
        throw new BadRequestException(
          `Invalid purchase order line id ${line.purchaseOrderLineId}`,
        );
      }

      if (lineIds.has(line.purchaseOrderLineId)) {
        throw new BadRequestException(
          `Duplicate purchase order line ${line.purchaseOrderLineId} in update request.`,
        );
      }
      lineIds.add(line.purchaseOrderLineId);

      const existingLine = linesById.get(lineId);

      if (!existingLine) {
        throw new BadRequestException(
          `Purchase order line ${line.purchaseOrderLineId} not found on this purchase order.`,
        );
      }

      const orderedQty = new Prisma.Decimal(line.orderedQty);

      if (orderedQty.lt(existingLine.receivedQty)) {
        throw new BadRequestException(
          `Ordered quantity cannot be less than received quantity for line ${line.purchaseOrderLineId}.`,
        );
      }

      return {
        id: lineId,
        orderedQty,
        unitCost: existingLine.unitCost,
      };
    });

    const purchaseOrderData: Prisma.PurchaseOrderUpdateManyMutationInput = {};

    if (dto.expectedAt !== undefined) {
      purchaseOrderData.expectedAt = dto.expectedAt
        ? new Date(dto.expectedAt)
        : null;
    }

    if (dto.notes !== undefined) {
      purchaseOrderData.notes = dto.notes;
    }

    return this.prismaService.$transaction(async (tx) => {
      if (Object.keys(purchaseOrderData).length > 0) {
        const updatedResult = await tx.purchaseOrder.updateMany({
          where: {
            id: poId,
            accountId,
            status: PurchaseOrderStatus.draft,
          },
          data: purchaseOrderData,
        });

        if (updatedResult.count !== 1) {
          throw new BadRequestException(
            `Purchase order ${purchaseOrderId} not found or not in draft status`,
          );
        }
      }

      for (const line of parsedLines) {
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: {
            orderedQty: line.orderedQty,
            lineTotal: line.unitCost
              ? line.orderedQty.mul(line.unitCost)
              : null,
          },
        });
      }

      const updatedPo = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: {
          vendor: true,
          lines: {
            include: {
              product: true,
              vendorProduct: true,
            },
          },
          receipts: true,
        },
      });

      if (!updatedPo) {
        throw new NotFoundException(
          `Purchase order with ID ${purchaseOrderId} not found after update`,
        );
      }

      return updatedPo;
    });
  }

  async submitPurchaseOrder(
    accountId: bigint,
    purchaseOrderId: string,
    locationCode: string,
  ) {
    let poId: bigint;

    try {
      poId = BigInt(purchaseOrderId);
    } catch {
      throw new BadRequestException('Invalid purchase order id');
    }

    const purchaseOrder = await this.prismaService.purchaseOrder.findFirst({
      where: { id: poId, accountId, locationCode },
      select: {
        id: true,
        status: true,
        lines: true,
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(
        `Purchase order with ID ${purchaseOrderId} at location ${locationCode} not found`,
      );
    }
    if (purchaseOrder.status !== PurchaseOrderStatus.draft) {
      throw new BadRequestException(
        `Only draft purchase orders can be submitted`,
      );
    }

    const now = new Date();

    const po = await this.prismaService.$transaction(async (tx) => {
      const updatedResult = await tx.purchaseOrder.updateMany({
        where: {
          id: poId,
          accountId,
          locationCode,
          status: PurchaseOrderStatus.draft,
        },
        data: {
          status: PurchaseOrderStatus.submitted,
          submittedAt: now,
          orderedAt: now,
        },
      });

      if (updatedResult.count !== 1) {
        throw new BadRequestException(
          `Purchase order ${purchaseOrderId} not found or not in draft status`,
        );
      }

      const updatedPo = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        select: {
          id: true,
          locationCode: true,
          vendor: true,
          lines: {
            include: {
              product: true,
              vendorProduct: true,
            },
          },
        },
      });

      if (!updatedPo) {
        throw new NotFoundException(
          `Purchase order with ID ${purchaseOrderId} at location ${locationCode} not found after update`,
        );
      }

      const affectedProducts = new Set<string>();
      for (const line of updatedPo.lines) {
        affectedProducts.add(
          `${line.productId.toString()}::${updatedPo.locationCode}`,
        );
      }

      for (const line of updatedPo.lines) {
        await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
          accountId,
          line.productId,
          updatedPo.locationCode,
          tx,
        );
      }

      return updatedPo;
    });

    return po;
  }

  async cancelPurchaseOrder(accountId: bigint, purchaseOrderId: string) {
    let poId: bigint;

    try {
      poId = BigInt(purchaseOrderId);
    } catch {
      throw new BadRequestException('Invalid purchase order id');
    }

    const purchaseOrder = await this.prismaService.purchaseOrder.findFirst({
      where: { id: poId, accountId },
      select: {
        id: true,
        status: true,
        locationCode: true,
        lines: {
          select: {
            productId: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(
        `Purchase order with ID ${purchaseOrderId} not found`,
      );
    }

    const cancellableStatuses: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.draft,
      PurchaseOrderStatus.submitted,
      PurchaseOrderStatus.partially_received,
    ];

    if (!cancellableStatuses.includes(purchaseOrder.status)) {
      throw new BadRequestException(
        `Purchase order cannot be cancelled from status ${purchaseOrder.status}.`,
      );
    }

    const shouldRecalculateIncoming =
      purchaseOrder.status === PurchaseOrderStatus.submitted ||
      purchaseOrder.status === PurchaseOrderStatus.partially_received;

    const now = new Date();

    const cancelledPo = await this.prismaService.$transaction(async (tx) => {
      const updatedResult = await tx.purchaseOrder.updateMany({
        where: {
          id: poId,
          accountId,
          status: { in: cancellableStatuses },
        },
        data: {
          status: PurchaseOrderStatus.cancelled,
          cancelledAt: now,
        },
      });

      if (updatedResult.count !== 1) {
        throw new BadRequestException(
          `Purchase order ${purchaseOrderId} not found or not in a cancellable status`,
        );
      }

      const updatedPo = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: {
          vendor: true,
          lines: {
            include: {
              product: true,
              vendorProduct: true,
            },
          },
          receipts: true,
        },
      });

      if (!updatedPo) {
        throw new NotFoundException(
          `Purchase order with ID ${purchaseOrderId} not found after cancellation`,
        );
      }

      if (shouldRecalculateIncoming) {
        const touchedProductIds = new Set<bigint>();
        for (const line of purchaseOrder.lines) {
          touchedProductIds.add(line.productId);
        }

        for (const productId of touchedProductIds) {
          await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
            accountId,
            productId,
            purchaseOrder.locationCode,
            tx,
          );
        }
      }

      return updatedPo;
    });

    return cancelledPo;
  }

  async receivePurchaseOrder(
    accountId: bigint,
    purchaseOrderId: string,
    dto: ReceivePurchaseOrderDto,
  ) {
    let poId: bigint;

    try {
      poId = BigInt(purchaseOrderId);
    } catch {
      throw new BadRequestException('Invalid purchase order id');
    }

    const po = await this.prismaService.purchaseOrder.findFirst({
      where: { id: poId, accountId },
      select: {
        id: true,
        locationCode: true,
        status: true,
        poNumber: true,
        lines: true,
      },
    });

    if (!po) {
      throw new NotFoundException(
        `Purchase order ${purchaseOrderId} not found`,
      );
    }

    if (
      po.status !== PurchaseOrderStatus.submitted &&
      po.status !== PurchaseOrderStatus.partially_received
    ) {
      throw new BadRequestException(
        `Purchase order cannot be received from status ${po.status}.`,
      );
    }
    const receivedAt = new Date(dto.receivedAt);
    if (isNaN(receivedAt.getTime())) {
      throw new BadRequestException(
        `Invalid receivedAt date ${dto.receivedAt}`,
      );
    }

    const result = await this.prismaService.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          accountId,
          purchaseOrderId: po.id,
          locationCode: po.locationCode,
          receivedAt,
          notes: dto.notes,
        },
      });

      //
      const seen = new Set<string>();

      for (const line of dto.lines) {
        if (seen.has(line.purchaseOrderLineId)) {
          throw new BadRequestException(
            `Duplicate purchase order line ${line.purchaseOrderLineId} in receipt request.`,
          );
        }
        seen.add(line.purchaseOrderLineId);
      }

      // Validate purchase order lines and prepare inventory ledger entries
      const poLineIds = dto.lines.map((line) =>
        BigInt(line.purchaseOrderLineId),
      );

      const poLines = await tx.purchaseOrderLine.findMany({
        where: {
          accountId,
          purchaseOrderId: po.id,
          id: { in: poLineIds },
        },
      });

      if (!poLines || poLines.length !== dto.lines.length) {
        throw new BadRequestException(
          'One or more purchase order lines were not found on this purchase order.',
        );
      }

      const poLinesById = new Map<bigint, (typeof poLines)[number]>();
      for (const poLine of poLines) {
        poLinesById.set(poLine.id, poLine);
      }

      const touchedProductIds = new Set<bigint>();

      for (const lineInput of dto.lines) {
        const poLineId = BigInt(lineInput.purchaseOrderLineId);
        const receivedQty = new Prisma.Decimal(lineInput.receivedQty);

        const poLine = poLinesById.get(poLineId);

        if (!poLine) {
          throw new BadRequestException(
            `Purchase order line ${lineInput.purchaseOrderLineId} not found on this purchase order.`,
          );
        }

        const newReceivedQty = poLine.receivedQty.plus(receivedQty);

        if (newReceivedQty.gt(poLine.orderedQty)) {
          throw new BadRequestException(
            `Received quantity exceeds ordered quantity for line ${poLineId.toString()}.`,
          );
        }

        await tx.purchaseOrderLine.update({
          where: { id: poLineId },
          data: {
            receivedQty: newReceivedQty,
          },
        });

        await tx.receiptLine.create({
          data: {
            accountId,
            receiptId: receipt.id,
            purchaseOrderLineId: poLine.id,
            productId: poLine.productId,
            receivedQty,
            unitCost: poLine.unitCost,
          },
        });

        await tx.inventoryLedger.create({
          data: {
            accountId,
            productId: poLine.productId,
            locationCode: po.locationCode,
            eventType: InventoryEventType.receipt,
            quantityDelta: receivedQty,
            unitCost: poLine.unitCost,
            referenceType: ReferenceType.receipt,
            referenceId: receipt.id,
            notes: `Receipt for PO ${po.poNumber}`,
            occurredAt: receivedAt,
            externalEventKey: `receipt:${receipt.id.toString()}:${poLine.id.toString()}`,
          },
        });

        touchedProductIds.add(poLine.productId);
      }

      const refreshedPo = await tx.purchaseOrder.findUnique({
        where: { id: po.id },
        select: {
          id: true,
          lines: true,
          vendor: true,
        },
      });

      if (!refreshedPo) {
        throw new NotFoundException(
          'Purchase order not found after receipt update.',
        );
      }

      const allReceived = refreshedPo.lines.every((line) =>
        line.receivedQty.gte(line.orderedQty),
      );

      const finalPo = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: allReceived
            ? PurchaseOrderStatus.received
            : PurchaseOrderStatus.partially_received,
        },
        include: {
          vendor: true,
          lines: {
            include: {
              product: true,
              vendorProduct: true,
            },
          },
        },
      });

      for (const productId of touchedProductIds) {
        await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
          accountId,
          productId,
          po.locationCode,
          tx,
        );
      }

      return finalPo;
    });

    return result;
  }
}
