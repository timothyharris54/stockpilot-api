import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { InventoryService } from '../inventory/inventory.service';
import { Prisma, OrderStatus } from '@prisma/client';

type OrderInput = {
    accountId: bigint,
    createOrderDto: CreateOrderDto
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService
  ) {}

    async create(input: OrderInput) {
        const accountId = input.accountId;
        const createOrderDto = input.createOrderDto;
        
        const order = await this.prisma.order.create({
            data: {
                accountId,
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
                        accountId,
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
                await this.inventoryService.postSaleEvent(accountId, line.id);
            }
        }

        return this.prisma.order.findUnique({
            where: { 
                accountId,
                id: order.id 
            },
            include: { orderLines: true }
        });
    }

    async cancel(accountId: bigint, orderId: string) {
        const id = BigInt(orderId);
        let order = await this.prisma.order.findFirst({
            where: {
                id,
                accountId: accountId,
            },
            include: {
                orderLines: true,
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        } 

        order = await this.prisma.order.update({
            where: { id },
            data: { status: 'cancelled' },
            include: { orderLines: true }
        });

        for (const line of order.orderLines) {
            await this.inventoryService.postSaleReversal(accountId, line.id);
        }
        return order;
    }

    async findAll(accountId: bigint) {
        return this.prisma.order.findMany({
            where: { accountId: accountId },
            include: { orderLines: true },
            orderBy: { orderedAt: 'desc' }
        });
    }
        
}
