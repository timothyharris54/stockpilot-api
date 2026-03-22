import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementService } from './procurement.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ProcurementService', () => {
  let service: ProcurementService;
  let inventoryService: InventoryService;
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
          useValue: { prismaMock } 
        }
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
