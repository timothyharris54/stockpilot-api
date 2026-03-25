import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ReplenishmentEngineService } from './replenishment-engine.service';
import { SalesDailyService } from './sales-daily.service';
import { InventoryPlanningService } from 'src/modules/inventory/services/inventory-planning.service';
import { log } from 'console';

describe('ReplenishmentEngineService', () => {
    let service: ReplenishmentEngineService;

    const prismaMock = {
    replenishmentRule: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    reorderRecommendation: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const salesDailyServiceMock = {
        getAverageDailySales: jest.fn(),
    };

    const inventoryPlanningServiceMock = {
        getPlanningPosition: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
            ReplenishmentEngineService,
            {
                provide: PrismaService,
                useValue: prismaMock,
            },
            {
                provide: SalesDailyService,
                useValue: salesDailyServiceMock,
            },
            {
                provide: InventoryPlanningService,
                useValue: inventoryPlanningServiceMock,
            },
            ],
        }).compile();

        service = module.get<ReplenishmentEngineService>(ReplenishmentEngineService);

        jest.clearAllMocks();
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('creates a reorder recommendation when available inventory is below reorder point', async () => {
        prismaMock.replenishmentRule.findUnique.mockResolvedValue({
        accountId: 1n,
        productId: 2n,
        locationCode: 'MAIN',
        safetyStock: 5,
        targetDaysOfCover: 30,
        overrideLeadTimeDays: 7,
        minReorderQty: 0,
        isActive: true,
        });

        salesDailyServiceMock.getAverageDailySales.mockResolvedValue(2);

        inventoryPlanningServiceMock.getPlanningPosition.mockResolvedValue({
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            qtyOnHand: 10,
            qtyReserved: 0,
            qtyIncoming: 0,
            qtyAvailable: 10,
        });

        prismaMock.reorderRecommendation.create.mockResolvedValue({
            id: 100n,
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            recommendedQty: '50.00',
        });

        const result = await service.generateForProduct(1n, 2n, 'MAIN');

        expect(prismaMock.replenishmentRule.findUnique).toHaveBeenCalledWith({
            where: {
                accountId_productId: {
                accountId: 1n,
                productId: 2n,
                },
            },
        });

        expect(salesDailyServiceMock.getAverageDailySales).toHaveBeenCalledWith(
            1n,
            2n,
            30,
        );

        expect(inventoryPlanningServiceMock.getPlanningPosition).toHaveBeenCalledWith(
            1n,
            2n,
            'MAIN',
        );

        expect(result.calculation.shouldReorder).toBe(true);
        expect(result.calculation.reorderPoint).toBe(19);
        expect(result.calculation.targetStock).toBe(60);
        expect(result.calculation.recommendedQty).toBe(50);

        expect(prismaMock.reorderRecommendation.create).toHaveBeenCalled();
    });

    it('does not recommend reorder when available inventory is above reorder point', async () => {
        prismaMock.replenishmentRule.findUnique.mockResolvedValue({
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            safetyStock: 5,
            targetDaysOfCover: 30,
            overrideLeadTimeDays: 7,
            minReorderQty: 0,
            isActive: true,
        });

        salesDailyServiceMock.getAverageDailySales.mockResolvedValue(2);

        inventoryPlanningServiceMock.getPlanningPosition.mockResolvedValue({
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            qtyOnHand: 24,
            qtyReserved: 0,
            qtyIncoming: 0,
            qtyAvailable: 24,
        });

        prismaMock.reorderRecommendation.create.mockResolvedValue({
            id: 101n,
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            recommendedQty: '0.00',
        });

        const result = await service.generateForProduct(1n, 2n, 'MAIN');

        expect(result.calculation.shouldReorder).toBe(false);
        expect(result.calculation.reorderPoint).toBe(19);
        expect(result.calculation.targetStock).toBe(60);
        expect(result.calculation.rawRecommendedQty).toBe(0);
        expect(result.calculation.recommendedQty).toBe(0);

        expect(prismaMock.reorderRecommendation.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            recommendedQty: '0',
            }),
        });
    });

    it('applies minimum reorder quantity when computed qty is smaller', async () => {
        prismaMock.replenishmentRule.findUnique.mockResolvedValue({
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            safetyStock: 5,
            targetDaysOfCover: 30,
            overrideLeadTimeDays: 7,
            minReorderQty: 12,
            isActive: true,
        });

        salesDailyServiceMock.getAverageDailySales.mockResolvedValue(1);

        inventoryPlanningServiceMock.getPlanningPosition.mockResolvedValue({
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            qtyOnHand: 7,
            qtyReserved: 0,
            qtyIncoming: 0,
            qtyAvailable: 7,
        });

        prismaMock.reorderRecommendation.create.mockResolvedValue({
            id: 102n,
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            recommendedQty: '12.00',
        });

        const result = await service.generateForProduct(1n, 2n, 'MAIN');
        console.log('result.calc: '+JSON.stringify(result.calculation));
        expect(result.calculation.shouldReorder).toBe(true);

        // avgDailySales = 1
        // leadTimeDemand = 1 * 7 = 7
        // reorderPoint = 7 + 5 = 12
        // targetStock = 1 * 30 = 30
        // rawRecommendedQty = 30 - 24 = 6
        // minReorderQty = 12 => recommendedQty should become 12

        expect(result.calculation.reorderPoint).toBe(12);
        expect(result.calculation.targetStock).toBe(30);
        expect(result.calculation.rawRecommendedQty).toBe(5);
        expect(result.calculation.recommendedQty).toBe(12);

        expect(prismaMock.reorderRecommendation.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
            recommendedQty: '12',
            }),
        });
    });  

    it('does not persist recommendation when dryRun is true', async () => {
    prismaMock.replenishmentRule.findUnique.mockResolvedValue({
        accountId: 1n,
        productId: 2n,
        locationCode: 'MAIN',
        safetyStock: 5,
        targetDaysOfCover: 30,
        overrideLeadTimeDays: 7,
        minReorderQty: 12,
        isActive: true,
    });

    salesDailyServiceMock.getAverageDailySales.mockResolvedValue(0.4);

    inventoryPlanningServiceMock.getPlanningPosition.mockResolvedValue({
        accountId: 1n,
        productId: 2n,
        locationCode: 'MAIN',
        qtyOnHand: 7,
        qtyReserved: 0,
        qtyIncoming: 0,
        qtyAvailable: 7,
    });

    const result = await service.generateForProduct(1n, 2n, 'MAIN', true);

    expect(prismaMock.reorderRecommendation.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.reorderRecommendation.create).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.recommendation).toBeNull();
    });    
   
    it('throws when no replenishment rule exists', async () => {
        prismaMock.replenishmentRule.findUnique.mockResolvedValue(null);

        await expect(
            service.generateForProduct(1n, 2n, 'MAIN'),
        ).rejects.toThrow('No replenishment rule found');
    });

    it('throws when replenishment rule is inactive', async () => {
        prismaMock.replenishmentRule.findUnique.mockResolvedValue({
            accountId: 1n,
            productId: 2n,
            locationCode: 'MAIN',
            safetyStock: 5,
            targetDaysOfCover: 30,
            overrideLeadTimeDays: 7,
            minReorderQty: 0,
            isActive: false,
        });

        await expect(
            service.generateForProduct(1n, 2n, 'MAIN'),
        ).rejects.toThrow('inactive');
    });    
});
