import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, ReferenceType } from '@prisma/client';
import { OpeningBalanceDto } from './dto/opening-balance.dto';

type InventoryInput = {
    accountId: bigint,
    openingBalanceDto: OpeningBalanceDto
}
@Injectable()
export class InventoryService {
    constructor(private readonly prismaService: PrismaService) {

    }

    async postOpeningBalance(input: InventoryInput) {
        const accountId = input.accountId;
        const openingBalanceDto = input.openingBalanceDto;
        const productId = BigInt(openingBalanceDto.productId);
        const quantity = new Prisma.Decimal(openingBalanceDto.quantity);
    
        const product = await this.prismaService.product.findUnique({
            where: { 
                id: productId
             }
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${productId} not found`);
        }

        const ledgerEntry = await this.prismaService.inventoryLedger.create({
            data: {
                accountId, 
                productId: productId,
                locationCode: openingBalanceDto.locationCode,
                eventType: 'opening_balance',
                quantityDelta: quantity,
                referenceType: 'system',
                externalEventKey: `opening_balance:${accountId}:${productId}:${openingBalanceDto.locationCode}`,
                occurredAt: new Date(),
                notes: openingBalanceDto.notes
            }
        });
        await this.rebuildBalance(accountId, productId, openingBalanceDto.locationCode);
        return ledgerEntry;
    }

    async postSaleEvent(accountId: bigint, orderLineId: bigint, locationCode= 'MAIN') {
        const orderLine = await this.prismaService.orderLine.findUnique({
            where: { 
                id: orderLineId,
                accountId
             },
            include: { order: true, product: true }
        });
        if (!orderLine || !orderLine.productId) {
            throw new NotFoundException(`Order line with ID ${orderLineId} not found`);
        }
        
        const externalEventKey = `${accountId}:${orderLine.order.channel}:order:${orderLine.order.channelOrderId}:line:${orderLine.id}:sale`;

        const existingEntry = await this.prismaService.inventoryLedger.findUnique({
            where: {
                accountId_externalEventKey: {
                    accountId,
                    externalEventKey: externalEventKey
                }
            }
        });
        if (existingEntry) {
            return existingEntry;
            // throw new NotFoundException(`Sale event for order line ${orderLineId} already exists`);
        }

        const ledgerEntry = await this.prismaService.inventoryLedger.create({
            data: {
                accountId,
                productId: orderLine.productId,
                locationCode,
                eventType: 'sale',
                quantityDelta: new Prisma.Decimal(orderLine.quantity.mul(-1)),
                referenceType: 'order',
                externalEventKey,
                occurredAt: orderLine.order.orderedAt,
                notes: `Sale for order ${orderLine.order.channelOrderId}`
            }
        });

        await this.rebuildBalance(accountId, orderLine.productId, locationCode);

        return ledgerEntry;
    }

    async postSaleReversal(accountId: bigint, orderLineId: bigint, locationCode= 'MAIN') {
        const orderLine = await this.prismaService.orderLine.findUnique({
            where: { 
                id: orderLineId,
                accountId
             },
            include: { order: true, product: true }
        });
        if (!orderLine || !orderLine.productId) {
            throw new NotFoundException(`Order line with ID ${orderLineId} not found`);
        }
        
        const externalEventKey = `${accountId}:${orderLine.order.channel}:order:${orderLine.order.channelOrderId}:line:${orderLine.id}:sale_reversal`;
        console.log('Looking for existing ledger entry with key:', externalEventKey);
        const existingEntry = await this.prismaService.inventoryLedger.findUnique({
            where: {
                accountId_externalEventKey: {
                    accountId,
                    externalEventKey: externalEventKey
                }
            }
        });
        if (existingEntry) {
            console.log('Existing ledger entry found for sale reversal:', existingEntry);
            return existingEntry;
        }

        const ledgerEntry = await this.prismaService.inventoryLedger.create({
            data: { 
                accountId,
                productId: orderLine.productId,
                locationCode,
                eventType: 'sale_reversal',
                quantityDelta: new Prisma.Decimal(orderLine.quantity),
                referenceType: 'order',
                referenceId: orderLine.orderId,
                externalEventKey,
                occurredAt: new Date(),
                notes: `Sale reversal for order ${orderLine.order.channelOrderId}`
            }
        });
        console.log('Created sale reversal ledger entry:', ledgerEntry);
        await this.rebuildBalance(orderLineId, orderLine.productId, locationCode);

        return ledgerEntry;
    }

    private async rebuildBalance(accountId: bigint, productId: bigint, locationCode: string) {
        const rows = await this.prismaService.inventoryLedger.findMany({
            where: { 
                accountId,
                productId, 
                locationCode 
            }
                //orderBy: { occurredAt: 'asc' }
        });
        const qtyOnHand = rows.reduce(
            (sum, row) => sum.add(row.quantityDelta),
            new Prisma.Decimal(0)
        );

        const qtyReserved = new Prisma.Decimal(0);
        const qtyIncoming = new Prisma.Decimal(0);
        const qtyAvailable = qtyOnHand.sub(qtyReserved);

        return this.prismaService.inventoryBalance.upsert({
            where: { 
                accountId_productId_locationCode: {
                    accountId,
                    productId,
                    locationCode
                }
            },
            update: { qtyOnHand, 
                qtyReserved, 
                qtyIncoming, 
                qtyAvailable, 
                lastCalculatedAt: new Date() 
            },
            create: { 
                accountId,
                productId, 
                locationCode, 
                qtyOnHand,
                qtyReserved,
                qtyIncoming,
                qtyAvailable,
                lastCalculatedAt: new Date() 
             }
        });
    }
    async getBalances(accountId: bigint) {
        return this.prismaService.inventoryBalance.findMany({
            where: { 
                accountId
            },
            include: { product: true },
            orderBy: [{ locationCode: 'asc' }, { product: { name: 'asc' } }]
            });    
    }
    async getLedger(accountId: bigint) {
        return this.prismaService.inventoryLedger.findMany({
            where: { 
                accountId 
            },
            include: { product: true },
            orderBy: { id: 'asc' },
        });
    }
    async postReceiptEvent(
            accountId: bigint,
            productId: bigint,
            locationCode: string,
            quantity: Prisma.Decimal,
            receiptId: bigint,
            notes?: string,
            unitCost?: Prisma.Decimal,
    )
    {
        const externalEventKey = `${ accountId }:receipt:${receiptId}`;

        const existingEntry = await this.prismaService.inventoryLedger.findUnique({
            where: {
                accountId_externalEventKey: {
                    accountId,
                    externalEventKey
                }
            }
        });
        if (existingEntry) {
            return existingEntry;
            // throw new NotFoundException(`Receipt event for receipt ${receiptId} already exists`);
        }
        
        const ledgerEntry = await this.prismaService.inventoryLedger.create({
            data: { 
                accountId,
                productId,
                locationCode,
                eventType: 'receipt',
                quantityDelta: new Prisma.Decimal(quantity),
                unitCost: unitCost || new Prisma.Decimal(0),
                referenceType: 'receipt',
                referenceId: receiptId,
                externalEventKey,
                occurredAt: new Date(),
                notes: notes || `Receipt for order ${receiptId}`,
            }
        });
        console.log('Created receipt ledger entry:', ledgerEntry);
        await this.rebuildBalance(accountId, productId, locationCode);

        return ledgerEntry;
    }

}