import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { RecommendationConversionService } from 'src/modules/procurement/services/recommendation-conversion.service';
import { InventoryBalanceService } from 'src/modules/inventory/services/inventory-balance.service';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import type { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

describe('ProcurementController', () => {
  let controller: ProcurementController;

  const identity: RequestIdentity = {
    userId: 10n,
    accountId: 1n,
    email: 'test@example.com',
  };

  const procurementServiceMock = {
    createPurchaseOrder: jest.fn(),
    findAllPurchaseOrders: jest.fn(),
    submitPurchaseOrder: jest.fn(),
    cancelPurchaseOrder: jest.fn(),
    receivePurchaseOrder: jest.fn(),
  };

  const recommendationConversionServiceMock = {
    convertRecommendations: jest.fn(),
    previewRecommendations: jest.fn(),
  };

  const inventoryBalanceServiceMock = {
    recalculateInventoryBalanceForProduct: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        {
          provide: ProcurementService,
          useValue: procurementServiceMock,
        },
        {
          provide: InventoryBalanceService,
          useValue: inventoryBalanceServiceMock,
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

  it('calls createPurchaseOrder with accountId from identity and dto', async () => {
    const createdPurchaseOrder = {
      id: 10n,
      accountId: 1n,
      status: 'draft',
    };

    const createPurchaseOrderDto = {
      vendorId: '5',
      lines: [],
    };

    procurementServiceMock.createPurchaseOrder.mockResolvedValue(
      createdPurchaseOrder,
    );

    const result = await controller.createPurchaseOrder(
      identity,
      createPurchaseOrderDto as any,
    );

    expect(procurementServiceMock.createPurchaseOrder).toHaveBeenCalledWith({
      accountId: 1n,
      createPurchaseOrderDto,
    });

    expect(result).toEqual(createdPurchaseOrder);
  });

  it('calls findAllPurchaseOrders with accountId from identity', async () => {
    const purchaseOrders = [
      { id: 10n, accountId: 1n, status: 'draft' },
      { id: 11n, accountId: 1n, status: 'submitted' },
    ];

    procurementServiceMock.findAllPurchaseOrders.mockResolvedValue(purchaseOrders);

    const result = await controller.findAllPurchaseOrders(identity);

    expect(procurementServiceMock.findAllPurchaseOrders).toHaveBeenCalledWith(
      1n,
    );

    expect(result).toEqual(purchaseOrders);
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

    const dto = { recommendationIds: ['101', '102'] };

    const result = await controller.convertRecommendations(identity, dto);

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

    const dto = { recommendationIds: ['101'] };

    const result = await controller.previewRecommendations(identity, dto);

    expect(
      recommendationConversionServiceMock.previewRecommendations,
    ).toHaveBeenCalledWith({
      accountId: 1n,
      recommendationIds: ['101'],
    });

    expect(result).toEqual(previewResult);
  });

  it('calls submitPurchaseOrder with accountId from identity and route id', async () => {
    const submittedPurchaseOrder = {
      id: 5n,
      accountId: 1n,
      status: 'submitted',
    };

    procurementServiceMock.submitPurchaseOrder.mockResolvedValue(
      submittedPurchaseOrder,
    );

    const dto = { locationCode: 'MAIN' };
    const result = await controller.submitPurchaseOrder(identity, '5', dto);

    expect(procurementServiceMock.submitPurchaseOrder).toHaveBeenCalledWith(
      1n,
      '5',
      'MAIN',
    );
    expect(result).toEqual(submittedPurchaseOrder);
  });

  it('calls cancelPurchaseOrder with accountId from identity and route id', async () => {
    const cancelledPurchaseOrder = {
      id: 5n,
      accountId: 1n,
      status: 'cancelled',
    };

    procurementServiceMock.cancelPurchaseOrder.mockResolvedValue(
      cancelledPurchaseOrder,
    );

    const result = await controller.cancelPurchaseOrder(identity, '5');

    expect(procurementServiceMock.cancelPurchaseOrder).toHaveBeenCalledWith(
      1n,
      '5',
    );
    expect(result).toEqual(cancelledPurchaseOrder);
  });

  it('receives part of a purchase order and sets status to partially_received', async () => {
    const receivedPurchaseOrder = {
      id: 5n,
      accountId: 1n,
      status: 'partially_received',
      lines: [
        {
          id: 10n,
          productId: 11n,
          orderedQty: 10,
          receivedQty: 5,
        },
      ],
    };
    const dto: ReceivePurchaseOrderDto = {
      receivedAt: '2026-04-12T12:00:00.000Z',
      notes: 'Received part of the purchase order',
      lines: [
        {
          purchaseOrderLineId: '10',
          productId: '11',
          receivedQty: '5',
        },
      ],
    };

    procurementServiceMock.receivePurchaseOrder.mockResolvedValue(
      receivedPurchaseOrder,
    );

    const result = await controller.receivePurchaseOrder(identity, '5', dto);

    expect(procurementServiceMock.receivePurchaseOrder).toHaveBeenCalledWith(
      1n,
      '5',
      dto,
    );
    expect(result).toEqual(receivedPurchaseOrder);
  });

  it('receives all quantities and sets status to received', async () => {
    const receivedPurchaseOrder = {
      id: 5n,
      accountId: 1n,
      status: 'received',
      lines: [
        {
          id: 10n,
          productId: 11n,
          orderedQty: 10,
          receivedQty: 10,
        },
      ],
    };

    const dto: ReceivePurchaseOrderDto = {
      receivedAt: '2026-04-12T12:00:00.000Z',
      notes: 'Received all items for the purchase order',
      lines: [
        {
          purchaseOrderLineId: '10',
          productId: '11',
          receivedQty: '10',
        },
      ],
    };

    procurementServiceMock.receivePurchaseOrder.mockResolvedValue(
      receivedPurchaseOrder,
    );

    const result = await controller.receivePurchaseOrder(identity, '5', dto);

    expect(procurementServiceMock.receivePurchaseOrder).toHaveBeenCalledWith(
      1n,
      '5',
      dto,
    );

    expect(result).toEqual(receivedPurchaseOrder);
  });  
});
