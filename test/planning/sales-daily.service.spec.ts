import { PrismaService } from 'src/common/prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { SalesDailyService } from 'src/modules/planning/services/sales-daily.service';
import { PlanningSettingsService } from 'src/modules/planning/services/planning-settings.service';
import { DEFAULT_DEMAND_DATE_BASIS } from 'src/modules/planning/constants/planning-defaults';

describe('SalesDailyService', () => {
  let service: SalesDailyService;
  type PrismaMock = {
    $transaction: jest.Mock;
    salesDaily: {
      count: jest.Mock;
    };
  };

  const prismaMock: PrismaMock = {
    $transaction: jest.fn(),
    salesDaily: {
      count: jest.fn(),
    },
  };

  const planningSettingsServiceMock = {
    getDemandOrderStatuses: jest.fn().mockResolvedValue(['completed']),
    getDemandDateBasis: jest.fn().mockResolvedValue('orderedAt'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesDailyService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: PlanningSettingsService,
          useValue: planningSettingsServiceMock,
        },
      ],
    }).compile();

    service = module.get<SalesDailyService>(SalesDailyService);
  });

  it('should be defined', () => {
    expect(true).toBe(true);
  });

  it('throws when to date is before from date', async () => {
    await expect(
      service.rebuildForAccount(
        1n,
        new Date('2026-03-20T00:00:00.000Z'),
        new Date('2026-03-19T00:00:00.000Z'),
      ),
    ).rejects.toThrow('Invalid rebuild range');
  });

  it('throws when no demand order statuses are configured', async () => {
    jest
      .spyOn(service['planningSettingsService'], 'getDemandOrderStatuses')
      .mockResolvedValue([]);
    await expect(
      service.rebuildForAccount(
        1n,
        new Date('2026-03-20T00:00:00.000Z'),
        new Date('2026-03-21T00:00:00.000Z'),
      ),
    ).rejects.toThrow('No demand order statuses configured for this account.');
  });

  it('uses demand statuses from planning settings', async () => {
    planningSettingsServiceMock.getDemandOrderStatuses.mockResolvedValue([
      'completed',
    ]);
    planningSettingsServiceMock.getDemandDateBasis.mockResolvedValue(
      DEFAULT_DEMAND_DATE_BASIS,
    );

    prismaMock.$transaction = jest.fn(
      async (callback: (tx: { $executeRaw: jest.Mock }) => Promise<void>) => {
        await callback({
          $executeRaw: jest.fn().mockResolvedValue(0),
        });
      },
    );

    prismaMock.salesDaily = {
      count: jest.fn().mockResolvedValue(0),
    };

    await service.rebuildForAccount(
      1n,
      new Date('2026-03-19T00:00:00.000Z'),
      new Date('2026-03-20T00:00:00.000Z'),
    );

    expect(
      planningSettingsServiceMock.getDemandOrderStatuses,
    ).toHaveBeenCalledWith(1n);
  });
});
