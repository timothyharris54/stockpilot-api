import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { InventoryService } from '../inventory/inventory.service';
import { Prisma } from '@prisma/client';
import { listeners } from 'process';
import { getAccountId } from '../../shared/account-context';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryService: InventoryService
  ) {}

    async create(createOrderDto: CreateOrderDto) {
        const order = await this.prismaService.order.create({
            data: {
                accountId: getAccountId(),
                channel: createOrderDto.channel,
                channelOrderId: createOrderDto.channelOrderId,
                status: createOrderDto.status as any,
                orderedAt: new Date(createOrderDto.orderedAt),
                customerName: createOrderDto.customerName,
                customerEmail: createOrderDto.customerEmail,
                currencyCode: createOrderDto.currencyCode,
                orderTotal: createOrderDto.orderTotal ? new Prisma.Decimal(createOrderDto.orderTotal) : undefined,
                orderLines: {
                    create: createOrderDto.lines.map(line => ({
                        accountId: getAccountId(),
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
            where: { 
                accountId: getAccountId(),
                id: order.id 
            },
            include: { orderLines: true }
        });
    }

    async cancel(orderId: string) {
        const id = BigInt(orderId);
        let order = await this.prismaService.order.findFirst({
        where: {
            id,
            accountId: getAccountId(),
        },
        include: {
            orderLines: true,
        },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        } 

        order = await this.prismaService.order.update({
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
            where: { accountId: getAccountId() },
            include: { orderLines: true },
            orderBy: { orderedAt: 'desc' }
        });
    }
        
}
