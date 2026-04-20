import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('OrdersService', () => {
  let service: OrdersService;

  const prismaMock = {};
  const inventoryServiceMock = {
    postSaleEvent: jest.fn(),
    postSaleReversal: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: InventoryService,
          useValue: inventoryServiceMock,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
