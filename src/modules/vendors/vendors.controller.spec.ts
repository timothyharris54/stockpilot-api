import { Test, TestingModule } from '@nestjs/testing';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('VendorsController', () => {
  let controller: VendorsController;
  const prismaMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorsController],
      providers: [
        { provide: VendorsService, useValue: prismaMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    controller = module.get<VendorsController>(VendorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
