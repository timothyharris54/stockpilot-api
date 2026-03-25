import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ReplenishmentEngineService } from 'src/modules/planning/services/replenishment-engine.service';
import { SalesDailyService } from 'src/modules/planning/services/sales-daily.service';
import { PlanningSettingsService } from 'src/modules/planning/services/planning-settings.service';
import { InventoryPlanningService } from 'src/modules/inventory/services/inventory-planning.service';

describe('ReplenishmentEngineService (integration)', () => {
  let prisma: PrismaService;
  let service: ReplenishmentEngineService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        PlanningSettingsService,
        SalesDailyService,
        InventoryPlanningService,
        ReplenishmentEngineService,
      ],
    }).compile();

    prisma = module.get(PrismaService);
    service = module.get(ReplenishmentEngineService);

    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.reorderRecommendation.deleteMany();
    await prisma.replenishmentRule.deleteMany();
    await prisma.salesDaily.deleteMany();
    await prisma.inventoryBalance.deleteMany();
    await prisma.product.deleteMany();
    await prisma.account.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a reorder recommendation end-to-end', async () => {
    const account = await prisma.account.create({
      data: { name: 'Integration Account' },
    });

    const product = await prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'TEST-1',
        name: 'Test Product',
      },
    });

    // Planning settings (required for SalesDailyService)
    await prisma.planningSettings.create({
      data: {
        accountId: account.id,
        demandOrderStatuses: ['completed'],
        demandDateBasis: 'orderedAt',
        includeNegativeAdjustments: false,
      },
    });

    // Seed SalesDaily directly (skip rebuild for simplicity)
    await prisma.salesDaily.create({
      data: {
        accountId: account.id,
        productId: product.id,
        salesDate: new Date('2026-03-01T00:00:00.000Z'),
        unitsSold: '12.00', // 12 units over 30 days → avg = 0.4
        revenue: '120.00',
      },
    });

    // Inventory is low → triggers reorder
    await prisma.inventoryBalance.create({
      data: {
        accountId: account.id,
        productId: product.id,
        locationCode: 'MAIN',
        qtyOnHand: '7.00',
        qtyReserved: '0.00',
        qtyIncoming: '0.00',
        qtyAvailable: '7.00',
      },
    });

    // Replenishment rule
    await prisma.replenishmentRule.create({
      data: {
        accountId: account.id,
        productId: product.id,
        locationCode: 'MAIN',
        safetyStock: '5.00',
        targetDaysOfCover: 30,
        overrideLeadTimeDays: 7,
        minReorderQty: '12.00',
        isActive: true,
      },
    });

    const result = await service.generateForProduct(
      account.id,
      product.id,
      'MAIN',
    );

    const rows = await prisma.reorderRecommendation.findMany({
      where: { accountId: account.id },
    });

    expect(rows).toHaveLength(1);

    const rec = rows[0];

    expect(Number(rec.recommendedQty)).toBe(12);

    expect(result.calculation.shouldReorder).toBe(true);
    expect(result.calculation.recommendedQty).toBe(12);
  });
});