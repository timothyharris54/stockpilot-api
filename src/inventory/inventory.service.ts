import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ReferenceType } from '@prisma/client';
import { OpeningBalanceDto } from './dto/opening-balance.dto';

@Injectable()
export class InventoryService {
    constructor(private readonly prismaService: PrismaService) {

    }

    async postOpeningBalance(openingBalanceDto: OpeningBalanceDto) {
        const productId = BigInt(openingBalanceDto.productId);
        const quantity = new Prisma.Decimal(openingBalanceDto.quantity);
    
        const product = await this.prismaService.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${productId} not found`);
        }

        const ledgerEntry = await this.prismaService.inventoryLedger.create({
            data: {
                productId: productId,
                locationCode: openingBalanceDto.locationCode,
                eventType: 'opening_balance',
                quantityDelta: quantity,
                referenceType: 'system',
                externalEventKey: `opening_balance:${productId}:${openingBalanceDto.locationCode}`,
                occurredAt: new Date(),
                notes: openingBalanceDto.notes
            }
        });
        await this.rebuildBalance(productId, openingBalanceDto.locationCode);
        return ledgerEntry;
    }

    async postSaleEvent(orderLineId: bigint, locationCode= 'MAIN') {
        const orderLine = await this.prismaService.orderLine.findUnique({
            where: { id: orderLineId },
            include: { order: true, product: true }
        });
        if (!orderLine || !orderLine.productId) {
            throw new NotFoundException(`Order line with ID ${orderLineId} not found`);
        }
        
        const externalEventKey = `${orderLine.order.channel}:order:${orderLine.order.channelOrderId}:line:${orderLine.id}:sale`;

        const existingEntry = await this.prismaService.inventoryLedger.findUnique({
            where: { externalEventKey: externalEventKey }
        });
        if (existingEntry) {
            return existingEntry;
            // throw new NotFoundException(`Sale event for order line ${orderLineId} already exists`);
        }

        const ledgerEntry = await this.prismaService.inventoryLedger.create({
            data: {
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

        await this.rebuildBalance(orderLine.productId, locationCode);

        return ledgerEntry;
    }

    async postSaleReversal(orderLineId: bigint, locationCode= 'MAIN') {
        const orderLine = await this.prismaService.orderLine.findUnique({
            where: { id: orderLineId },
            include: { order: true, product: true }
        });
        if (!orderLine || !orderLine.productId) {
            throw new NotFoundException(`Order line with ID ${orderLineId} not found`);
        }
        
        const externalEventKey = `${orderLine.order.channel}:order:${orderLine.order.channelOrderId}:line:${orderLine.id}:sale_reversal`;
        console.log('Looking for existing ledger entry with key:', externalEventKey);
        const existingEntry = await this.prismaService.inventoryLedger.findUnique({
            where: { externalEventKey }
        });
        if (existingEntry) {
            console.log('Existing ledger entry found for sale reversal:', existingEntry);
            return existingEntry;
        }

        const ledgerEntry = await this.prismaService.inventoryLedger.create({
            data: {
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
        await this.rebuildBalance(orderLine.productId, locationCode);

        return ledgerEntry;
    }

    private async rebuildBalance(productId: bigint, locationCode: string) {
        const rows = await this.prismaService.inventoryLedger.findMany({
            where: { productId, locationCode }
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
            where: { productId_locationCode: { productId, locationCode } },
            update: { qtyOnHand, 
                qtyReserved, 
                qtyIncoming, 
                qtyAvailable, 
                lastCalculatedAt: new Date() 
            },
            create: { 
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
    async getBalances() {
        return this.prismaService.inventoryBalance.findMany({
            include: { product: true },
            orderBy: { productId: 'asc' }
            });    
    }
    async getLedger() {
        return this.prismaService.inventoryLedger.findMany({
        include: { product: true },
        orderBy: { id: 'asc' },
        });
    }        
}