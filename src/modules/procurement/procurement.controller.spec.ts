import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { RecommendationConversionService } from 'src/modules/procurement/services/recommendation-conversion.service';

describe('ProcurementController', () => {
  let controller: ProcurementController;

  const procurementServiceMock = {
    createPurchaseOrder: jest.fn(),
    findAllPurchaseOrders: jest.fn(),
    submitPurchaseOrder: jest.fn(),
    receivePurchaseOrder: jest.fn(),
  };

  const recommendationConversionServiceMock = {
    convertRecommendations: jest.fn(),
    previewRecommendations: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        { 
          provide: ProcurementService, 
          useValue: procurementServiceMock 
        },
        {
          provide: RecommendationConversionService,
          useValue: recommendationConversionServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ProcurementController>(ProcurementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('calls convertRecommendations with accountId from identity and recommendationIds from dto', async () => {
    const convertResult = {
      createdPurchaseOrders: 1,
      convertedRecommendations: 2,
      purchaseOrders: [
        {
          purchaseOrderId: '9001',
          vendorId: '501',
          lineCount: 2,
          totalOrderedQty: '24',
          totalCost: '264.00',
        },
      ],
    };

    recommendationConversionServiceMock.convertRecommendations.mockResolvedValue(
      convertResult,
    );

    const identity = { accountId: '1' };
    const dto = { recommendationIds: ['101', '102'] };

    const result = await controller.convertRecommendations(identity as any, dto);

    expect(
      recommendationConversionServiceMock.convertRecommendations,
    ).toHaveBeenCalledWith({
      accountId: 1n,
      recommendationIds: ['101', '102'],
    });

    expect(result).toEqual(convertResult);
  });

  it('calls previewRecommendations with accountId from identity and recommendationIds from dto', async () => {
    const previewResult = {
      vendorGroups: [
        {
          vendorId: '501',
          lineCount: 1,
          totalOrderedQty: '12',
          totalCost: '99.00',
          lines: [
            {
              recommendationId: '101',
              productId: '11',
              vendorProductId: '201',
              recommendedQty: '5',
              finalQty: '12',
              unitCost: '8.25',
              lineTotal: '99.00',
            },
          ],
        },
      ],
      totalGroups: 1,
      totalRecommendations: 1,
    };

    recommendationConversionServiceMock.previewRecommendations.mockResolvedValue(
      previewResult,
    );

    const identity = { accountId: '1' };
    const dto = { recommendationIds: ['101'] };

    const result = await controller.previewRecommendations(identity as any, dto);

    expect(
      recommendationConversionServiceMock.previewRecommendations,
    ).toHaveBeenCalledWith({
      accountId: 1n,
      recommendationIds: ['101'],
    });

    expect(result).toEqual(previewResult);
  });  
});