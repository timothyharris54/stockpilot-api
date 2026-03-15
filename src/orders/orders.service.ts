import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { InventoryService } from 'src/inventory/inventory.service';
import { Prisma } from '@prisma/client';
import { listeners } from 'process';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryService: InventoryService
  ) {}

    async create(createOrderDto: CreateOrderDto) {
        const order = await this.prismaService.order.create({
            data: {
                channel: createOrderDto.channel,
                channelOrderId: createOrderDto.channelOrderId,
                status: createOrderDto.status as any,
                orderedAt: new Date(createOrderDto.orderDate),
                customerName: createOrderDto.customerName,
                customerEmail: createOrderDto.customerEmail,
                currencyCode: createOrderDto.currencyCode,
                orderTotal: createOrderDto.orderTotal ? new Prisma.Decimal(createOrderDto.orderTotal) : undefined,
                orderLines: {
                    create: createOrderDto.orderLines.map(line => ({
                        productId: line.productId ? BigInt(line.productId) : undefined,
                        channelLineId: line.channelLineId,
                        sku: line.sku,
                        productName: line.productName,
                        quantity: line.quantity,
                        unitPrice: line.unitPrice ? new Prisma.Decimal(line.unitPrice) : undefined,
                        lineTotal: line.lineTotal ? new Prisma.Decimal(line.lineTotal) : undefined
                    }))
                }
            },
            include: { orderLines: true }
        });

        if (['processing', 'paid', 'completed'].includes(createOrderDto.status)) {
            for (const line of order.orderLines) {
                await this.inventoryService.postSaleEvent(line.id);
            }
        }

        return this.prismaService.order.findUnique({
            where: { id: order.id },
            include: { orderLines: true }
        });
    }

    async cancel(orderId: string) {
        const id = BigInt(orderId);
        const order = await this.prismaService.order.update({
            where: { id },
            data: { status: 'cancelled' },
            include: { orderLines: true }
        });

        for (const line of order.orderLines) {
            await this.inventoryService.postSaleReversal(line.id);
        }
        return order;
    }

    findAll() {
        return this.prismaService.order.findMany({
            include: { orderLines: true },
            orderBy: { id: 'asc' }
        });
    }   
}
