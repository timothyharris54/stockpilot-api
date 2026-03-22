import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductsController } from '../products/products.controller';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let productsService: ProductsService;
  let controller: InventoryController;  
  let productsController: ProductsController;

  const prismaMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        InventoryController, 
        ProductsController
      ],
      providers: [
        InventoryService,
        { 
          provide: PrismaService, 
          useValue: prismaMock
        },
        ProductsService,
        { 
          provide: PrismaService, 
          useValue: prismaMock
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
