import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementService } from './procurement.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ProcurementService', () => {
  let service: ProcurementService;

  const inventoryServiceMock = {};
  const prismaMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        { 
          provide: PrismaService, 
          useValue: { prismaMock } 
        },
        { 
          provide: InventoryService, 
          useValue: { inventoryServiceMock } 
        }
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
