import { Test, TestingModule } from '@nestjs/testing';
import { SalesDailyController } from './sales-daily.controller';
import { SalesDailyService } from '../../services/sales-daily.service';
import { ProcurementService } from '../../../../modules/procurement/procurement.service';
import { PlanningSettingsService } from '../../services/planning-settings.service';
import { InventoryService } from '../../../inventory/inventory.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

describe('SalesDailyController', () => {
  let controller: SalesDailyController;

  const prismaMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesDailyController],
      providers: [
        SalesDailyService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        ProcurementService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        PlanningSettingsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        InventoryService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    controller = module.get<SalesDailyController>(SalesDailyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
