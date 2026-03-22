import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ProcurementController', () => {
  let controller: ProcurementController;
  let service: ProcurementService;
  const prismaMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        { provide: ProcurementService, useValue: { prismaMock } },
        { provide: PrismaService, useValue: { prismaMock } },],
    }).compile();

    controller = module.get<ProcurementController>(ProcurementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
