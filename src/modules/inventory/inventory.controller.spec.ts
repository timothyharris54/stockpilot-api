import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductsService } from '../products/products.service';

describe('InventoryController', () => {
  let controller: InventoryController;

  const prismaMock = {
    getReservations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: prismaMock },
        { provide: ProductsService, useValue: prismaMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getReservations to the service', async () => {
    const identity = { accountId: 1n } as any;
    const query = { productId: '331', locationCode: 'MAIN', take: 50 };
    prismaMock.getReservations.mockResolvedValue([]);

    const result = await controller.getReservations(identity, query as any);

    expect(prismaMock.getReservations).toHaveBeenCalledWith(1n, query);
    expect(result).toEqual([]);
  });
});
