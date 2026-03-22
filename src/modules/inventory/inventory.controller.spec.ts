import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductsController } from '../products/products.controller';
import { ProductsService } from '../products/products.service';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: InventoryService;
  let productsService: ProductsService;
  let productsController: ProductsController;

  const prismaMock = {};  
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: { prismaMock } },
        { provide: ProductsService, useValue: { prismaMock } },
        { provide: PrismaService, useValue: { prismaMock } },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
