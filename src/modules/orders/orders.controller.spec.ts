import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service'; 
import { PrismaService } from '../../common/prisma/prisma.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: OrdersService;
  const prismaMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: { prismaMock } },
        { provide: PrismaService, useValue: { prismaMock } },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
