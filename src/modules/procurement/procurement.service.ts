import { BadRequestException,
        Injectable,
        NotFoundException
     } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { getAccountId } from '../../shared/account-context';  
import { InventoryService } from '../inventory/inventory.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

@Injectable()
export class ProcurementService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly inventoryService: InventoryService
    ) {}

    async createPurchaseOrder(createPurchaseOrderDto: CreatePurchaseOrderDto) {
        const accountId = getAccountId();
        const vendorId = BigInt(createPurchaseOrderDto.vendorId);
        const vendor = await this.prismaService.vendor.findFirst({
            where: { id: vendorId, accountId }
        });
        if (!vendor) {
            throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
        }   

        for (const line of createPurchaseOrderDto.lines) {
            const productId = BigInt(line.productId);
            const product = await this.prismaService.product.findFirst({
                where: { id: productId, accountId }
            });
            if (!product) {
                throw new NotFoundException(`Product with ID ${productId} not found`);
            }
            if (line.vendorProductId) { 
                const existingVendorProduct = await this.prismaService.vendorProduct.findFirst({
                    where: { 
                        id: BigInt(line.vendorProductId),
                        accountId,
                        vendorId,
                        productId
                    }
                });
                if (!existingVendorProduct) {
                    throw new BadRequestException(
                        `Vendor product with ID ${line.vendorProductId} not found for product ${productId} and vendor ${vendorId}`
                    );
                }
            }
        }
    
        return this.prismaService.purchaseOrder.create({
            data: {
                accountId,
                vendorId,
                poNumber: createPurchaseOrderDto.poNumber,
                expectedAt: createPurchaseOrderDto.expectedAt ? new Date(createPurchaseOrderDto.expectedAt) : undefined,
                notes: createPurchaseOrderDto.notes,
                status: 'draft',
                lines: {
                    create: createPurchaseOrderDto.lines.map((line) => {
                        const orderdQty = new Prisma.Decimal(line.orderedQty);
                        const unitCost = line.unitCost ? new Prisma.Decimal(line.unitCost) : undefined;

                        return {
                            accountId,
                            productId: BigInt(line.productId),
                            vendorProductId: line.vendorProductId ? BigInt(line.vendorProductId) : undefined,
                            orderedQty: new Prisma.Decimal(line.orderedQty),
                            unitCost: line.unitCost ? new Prisma.Decimal(line.unitCost) : undefined,
                            lineTotal: unitCost ? orderdQty.mul(unitCost) : undefined
                        };
                    })
                }
            }
        });
    }

    async findAllPurchaseOrders() {
        const accountId = getAccountId();
        return this.prismaService.purchaseOrder.findMany({
            where: { accountId },
            include: { 
                vendor: true,
                lines: {
                    include:  {
                        product: true,
                        vendorProduct: true
                    },
                },
                receipts: true,
            },
            orderBy: {
                id: 'asc'
            },
        });
    }

    async submitPurchaseOrder(purchaseOrderId: string) {
        const accountId = getAccountId();
        const poId = BigInt(purchaseOrderId);

        const purchaseOrder = await this.prismaService.purchaseOrder.findFirst({
            where: { id: poId, accountId },
            include: { lines: true }
        });

        if (!purchaseOrder) {
            throw new NotFoundException(`Purchase order with ID ${purchaseOrderId} not found`);
        }
        if (purchaseOrder.status !== 'draft') {
            throw new BadRequestException(`Only draft purchase orders can be submitted`);
        }

        const po = await this.prismaService.$transaction(async (tx) => {
            const updatedPo = await tx.purchaseOrder.update({
                where: { id: poId },
                data: { 
                    status: 'submitted',
                    submittedAt: new Date(),
                    orderedAt: new Date(),
                },
                include: { 
                    vendor: true,
                    lines: {
                        include:  {
                            product: true,
                            vendorProduct: true
                        }
                    }
                }
            });

            for (const line of purchaseOrder.lines) {
                await this.updateIncomingForProduct(tx, accountId, line.productId, 'MAIN');
            }
            
            return updatedPo;
         });
    }

    async receivePurchaseOrder(id: string, receivePurchaseOrderDto: ReceivePurchaseOrderDto) 
    {
        const poId = BigInt(id);
        const accountId = getAccountId();

        // Validate purchase order exists
        const purchaseOrder = await this.prismaService.purchaseOrder.findUnique({
            where: { id: poId, accountId },
            include: { lines: true }
        });

        if (!purchaseOrder) {
            throw new NotFoundException(`Purchase order with ID ${id} not found`);
        }

        if (!['submitted', 'partially_received'].includes(purchaseOrder.status)) {
            throw new BadRequestException(
                'Only submitted or partially received purchase orders can be received'
            );
        }

        // Process each received line
        for (const line of receivePurchaseOrderDto.lines) {
            const poLineId = BigInt(line.purchaseOrderLineId);
            const poLine = purchaseOrder.lines.find(l => l.id === poLineId);

            if (!poLine) {
                throw new BadRequestException(
                    `Received qty must be greater than 0 and not exceed ordered qty for PO Line: ${line.purchaseOrderLineId}`
                );
            }

            const receivedQty = new Prisma.Decimal(line.receivedQty);
            const remainingQty = poLine.orderedQty.minus(receivedQty);

            if (remainingQty.isNeg()) {
                throw new BadRequestException('Received quantity must be greater than zero');
            }

            if (remainingQty.gt(remainingQty)) {
                throw new BadRequestException(
                    `Received quantity exceeds remaining quantity for PO line ${line.purchaseOrderLineId}`,
              );            
            }

            return this.prismaService.$transaction(async (tx) => {
                // Create purchase order receipt    
                const receipt = await tx.receipt.create({
                    data: {
                        accountId,
                        purchaseOrderId: purchaseOrder.id,
                        receivedAt: new Date(receivePurchaseOrderDto.receivedAt),
                        locationCode: receivePurchaseOrderDto.locationCode,
                        notes: receivePurchaseOrderDto.notes,
                        lines: {
                            create: receivePurchaseOrderDto.lines.map(line => ({
                                accountId,
                                purchaseOrderLineId: BigInt(line.purchaseOrderLineId),
                                productId: BigInt(line.productId),
                                receivedQty: new Prisma.Decimal(line.receivedQty),
                                unitCost: line.unitCost 
                                    ? new Prisma.Decimal(line.unitCost) 
                                    : undefined
                            })),
                        },
                    },
                    include: { lines: true }
                });

                for (const line of receivePurchaseOrderDto.lines) { 
                    const poLineId = BigInt(line.purchaseOrderLineId);
                    const receivedQty = new Prisma.Decimal(line.receivedQty);
                    const unitCost = line.unitCost ? new Prisma.Decimal(line.unitCost) : undefined;
                    const productId = BigInt(line.productId);
                    
                    const poLine = await tx.purchaseOrderLine.findFirst( {
                        where: { 
                            id: poLineId, 
                            accountId,
                            purchaseOrderId: purchaseOrder.id 
                        },
                    });

                    if (!poLine) {
                        throw new NotFoundException(`PO line with ID ${line.purchaseOrderLineId} not found in purchase order ${purchaseOrder.id}`);
                    }

                    const newReceivedQty = poLine.receivedQty.plus(receivedQty);
                    
                    await tx.purchaseOrderLine.update({
                        where: { id: poLineId },
                        data: { receivedQty: newReceivedQty }
                    }); 

                    // Create inventory ledger entry for the received quantity
                    await this.inventoryService.postReceiptEvent(
                        productId,
                        receivePurchaseOrderDto.locationCode,
                        receivedQty,
                        receipt.id,
                        receivePurchaseOrderDto.notes,
                        unitCost,
                    );

                    await this.updateIncomingForProduct(tx, accountId, productId, receivePurchaseOrderDto.locationCode);

                }

                const refreshedLines = await tx.purchaseOrderLine.findMany({
                    where: { purchaseOrderId: poId, accountId }
                });
                
                const allReceived = refreshedLines.every((line) => 
                    line.receivedQty.gte(line.orderedQty)
                );

                const anyReceived = refreshedLines.some((line) => 
                    line.receivedQty.gt(new Prisma.Decimal(0))
                );

                const newStatus: PurchaseOrderStatus = allReceived 
                    ? 'received' 
                    : anyReceived 
                        ? 'partially_received' 
                        : 'submitted';

                await tx.purchaseOrder.update({
                    where: { id: poId },
                    data: { 
                        status: newStatus 
                    }
                });

                    return tx.purchaseOrder.findFirst({
                        where: { id: poId, accountId },
                        include: { 
                            vendor: true,
                            lines: {
                                include:  {
                                    product: true,
                                    vendorProduct: true
                                }
                            },
                            receipts: {
                                include: {
                                    lines: true,
                                },
                            },
                        },
                    });
                });
            }
        }
    
        private async updateIncomingForProduct(
            tx: Prisma.TransactionClient,
            accountId: bigint,
            productId: bigint,
            locationCode: string) 
        {
            const openLines = await tx.purchaseOrderLine.findMany({
                where: {
                    accountId,
                    productId,
                    purchaseOrder: {
                        accountId,
                        status: {
                            in: ['submitted', 'partially_received']
                        },
                    },
                },
            });
    
            const qtyIncoming = openLines.reduce(
                (sum, line) => sum.plus(line.orderedQty.minus(line.receivedQty)), 
                new Prisma.Decimal(0)
            );
    
            const existingBalance = await tx.inventoryBalance.findFirst({
                where: { 
                    accountId,
                    productId,
                    locationCode
                },
            });
            
            if (existingBalance) {
                const qtyAvailable = existingBalance.qtyOnHand.minus(existingBalance.qtyReserved);
                await tx.inventoryBalance.update({
                    where: { 
                        accountId_productId_locationCode: {
                            accountId,
                            productId,
                            locationCode
                        },
                    },
                    data: {
                        qtyIncoming,
                        qtyAvailable: qtyAvailable.plus(qtyIncoming),
                        lastCalculatedAt: new Date(),
                    },
                });
            } else {
                await tx.inventoryBalance.create({
                    data: {
                        accountId,
                        productId,
                        locationCode,
                        qtyOnHand: new Prisma.Decimal(0),
                        qtyReserved: new Prisma.Decimal(0),
                        qtyIncoming,
                        qtyAvailable: qtyIncoming,
                        lastCalculatedAt: new Date(),
                    },
                });
            }
        }
    }


