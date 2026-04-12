import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SalesDailyService } from 'src/modules/planning/services/sales-daily.service';
import { PlanningSettingsService } from 'src/modules/planning/services/planning-settings.service';

describe('SalesDailyService (integration)', () => {
  let prisma: PrismaService;
  let service: SalesDailyService;
  let createdAccountIds: bigint[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, PlanningSettingsService, SalesDailyService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<SalesDailyService>(SalesDailyService);

    await prisma.$connect();
  });

  beforeEach(() => {
    createdAccountIds = [];
  });

  afterEach(async () => {
    if (createdAccountIds.length > 0) {
      await prisma.account.deleteMany({
        where: {
          id: {
            in: createdAccountIds,
          },
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
  it('creates SalesDaily from completed orders', async () => {
    const account = await prisma.account.create({
      data: { name: 'Integration Test Account' },
    });
    createdAccountIds.push(account.id);

    await prisma.planningSettings.create({
      data: {
        accountId: account.id,
        demandOrderStatuses: ['completed'],
        demandDateBasis: 'orderedAt',
        includeNegativeAdjustments: false,
      },
    });

    const product = await prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'ITEST-SKU-1',
        name: 'Test Product 1',
      },
    });

    const product2 = await prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'ITEST-SKU-2',
        name: 'Test Product 2',
      },
    });

    const order = await prisma.order.create({
      data: {
        accountId: account.id,
        channel: 'manual',
        channelOrderId: 'ORDER-1001',
        status: 'completed',
        orderedAt: new Date('2026-03-22T10:00:00Z'),
      },
    });

    await prisma.orderLine.create({
      data: {
        accountId: account.id,
        orderId: order.id,
        productId: product.id,
        quantity: '2.00',
        unitPrice: '10.00',
        lineTotal: '20.00',
      },
    });

    const order2 = await prisma.order.create({
      data: {
        accountId: account.id,
        channel: 'manual',
        channelOrderId: 'ORDER-1002',
        status: 'completed',
        orderedAt: new Date('2026-03-22T10:00:00Z'),
      },
    });

    await prisma.orderLine.create({
      data: {
        accountId: account.id,
        orderId: order2.id,
        productId: product2.id,
        quantity: '3.00',
        unitPrice: '10.00',
        lineTotal: '30.00',
      },
    });

    await service.rebuildForAccount(
      account.id,
      new Date('2026-03-22T00:00:00.000Z'),
      new Date('2026-03-22T23:59:59.999Z'),
    );

    const rows = await prisma.salesDaily.findMany({
      where: { accountId: account.id },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].accountId).toBe(account.id);
    expect(rows[0].productId).toBe(product.id);
    expect(rows[0].salesDate.toISOString()).toBe('2026-03-22T00:00:00.000Z');
    expect(Number(rows[0].unitsSold)).toBe(2);
    expect(Number(rows[1].unitsSold)).toBe(3);
    expect(Number(rows[0].revenue)).toBe(20);
    expect(Number(rows[1].revenue)).toBe(30);
  });
  /*
  it('does not create SalesDaily for cancelled orders', async () => {
    const account = await prisma.account.create({
      data: { name: 'Integration Test Account' },
    });

    await prisma.planningSettings.create({
        data: {
          accountId: account.id,
          demandOrderStatuses: ['completed'],
          demandDateBasis: 'orderedAt',
          includeNegativeAdjustments: false,
        },
      });

      const product = await prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'ITEST-SKU-1',
        name: 'Test Product 1',
      },
    });

    const order = await prisma.order.create({
      data: {
        accountId: account.id,
        channel: 'manual',
        channelOrderId: 'ORDER-1001',
        status: 'completed',
        orderedAt: new Date('2026-03-22T10:00:00Z'),
      },
    });

    await prisma.orderLine.create({
      data: {
        accountId: account.id,
        orderId: order.id,
        productId: product.id,
        quantity: '2.00',
        unitPrice: '10.00',
        lineTotal: '20.00',
      },
    });

    const order2 = await prisma.order.create({
      data: {
        accountId: account.id,
        channel: 'manual',
        channelOrderId: 'ORDER-1002',
        status: 'completed',
        orderedAt: new Date('2026-03-22T10:00:00Z'),
      },
    });

    await prisma.orderLine.create({
      data: {
        accountId: account.id,
        orderId: order.id,
        productId: product.id,
        quantity: '3.00',
        unitPrice: '10.00',
        lineTotal: '30.00',
      },
    });

    await service.rebuildForAccount(
      account.id,
      new Date('2026-03-22T00:00:00.000Z'),
      new Date('2026-03-22T23:59:59.999Z'),
    );

    const rows = await prisma.salesDaily.findMany({
      where: { accountId: account.id },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].accountId).toBe(account.id);
    expect(rows[0].productId).toBe(product.id);
    expect(rows[0].salesDate.toISOString()).toBe('2026-03-22T00:00:00.000Z');
    expect(Number(rows[0].unitsSold)).toBe(5);
    expect(Number(rows[0].revenue)).toBe(50);

  });  
  */
});
