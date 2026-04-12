import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementService } from './procurement.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';

describe('ProcurementService', () => {
  let service: ProcurementService;

  const prismaMock = {
    purchaseOrder: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const inventoryServiceMock = {
    postReceiptEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
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

    service = module.get<ProcurementService>(ProcurementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  // Happy path test for submitPurchaseOrder - more tests to be added for edge cases and error handling
  it('submits a draft purchase order', async () => {
    const accountId = 1n;

    const purchaseOrder = {
      id: 5n,
      accountId,
      status: 'draft',
      lines: [{ productId: 11n }, { productId: 12n }],
    };

    prismaMock.purchaseOrder.findFirst.mockResolvedValue(purchaseOrder);

    const updatedPo = {
      id: 5n,
      accountId,
      status: 'submitted',
    };

    const txMock = {
      purchaseOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(updatedPo),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    prismaMock.$transaction.mockImplementation((cb) => cb(txMock));

    const updateIncomingSpy = jest.spyOn(
      service as unknown as {
        updateIncomingForProduct: (...args: unknown[]) => Promise<void>;
      },
      'updateIncomingForProduct',
    );
    updateIncomingSpy.mockResolvedValue(undefined);

    const result = await service.submitPurchaseOrder(accountId, '5');

    expect(prismaMock.purchaseOrder.findFirst).toHaveBeenCalledWith({
      where: { id: 5n, accountId },
      include: { lines: true },
    });

    const updateManyCalls = txMock.purchaseOrder.updateMany.mock.calls;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const updateManyArg = updateManyCalls[0]?.[0] as {
      where: {
        id: bigint;
        accountId: bigint;
        status: PurchaseOrderStatus;
      };
      data: {
        status: PurchaseOrderStatus;
        submittedAt: Date;
        orderedAt: Date;
      };
    };

    expect(updateManyArg.where).toEqual({
      id: 5n,
      accountId,
      status: PurchaseOrderStatus.draft,
    });
    expect(updateManyArg.data.status).toBe(PurchaseOrderStatus.submitted);
    expect(updateManyArg.data.submittedAt).toBeInstanceOf(Date);
    expect(updateManyArg.data.orderedAt).toBeInstanceOf(Date);

    expect(txMock.purchaseOrder.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5n },
      }),
    );

    expect(updateIncomingSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual(updatedPo);
  });

  it('throws BadRequestException for invalid purchase order id', async () => {
    await expect(service.submitPurchaseOrder(1n, 'abc')).rejects.toThrow(
      'Invalid purchase order id',
    );

    expect(prismaMock.purchaseOrder.findFirst).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when purchase order is not found', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

    await expect(service.submitPurchaseOrder(1n, '5')).rejects.toThrow(
      'not found',
    );
  });

  it('throws BadRequestException when purchase order is not draft', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: 5n,
      accountId: 1n,
      status: PurchaseOrderStatus.submitted,
      lines: [],
    });

    await expect(service.submitPurchaseOrder(1n, '5')).rejects.toThrow(
      'Only draft purchase orders can be submitted',
    );
  });

  it('throws when updateMany fails due to concurrent update', async () => {
    const accountId = 1n;

    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: 5n,
      accountId,
      status: PurchaseOrderStatus.draft,
      lines: [],
    });

    const txMock = {
      purchaseOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    prismaMock.$transaction.mockImplementation((cb) => cb(txMock));

    await expect(service.submitPurchaseOrder(accountId, '5')).rejects.toThrow(
      'not found or not in draft status',
    );
  });

  it('receives all quantities and sets status to received', async () => {
    const po = {
      id: 5n,
      accountId: 1n,
      status: 'submitted',
      lines: [
        {
          id: 10n,
          productId: 11n,
          orderedQty: new Prisma.Decimal(10),
          receivedQty: new Prisma.Decimal(0),
        },
      ],
    };

    prismaMock.purchaseOrder.findUnique.mockResolvedValue(po);

    const txMock = {
      receipt: {
        create: jest.fn().mockResolvedValue({
          id: 100n,
          lines: [],
        }),
      },
      purchaseOrderLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: 10n,
          accountId: 1n,
          purchaseOrderId: 5n,
          productId: 11n,
          orderedQty: new Prisma.Decimal(10),
          receivedQty: new Prisma.Decimal(0),
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 10n,
            orderedQty: new Prisma.Decimal(10),
            receivedQty: new Prisma.Decimal(10),
          },
        ]),
        update: jest.fn(),
      },
      purchaseOrder: {
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({
          ...po,
          status: PurchaseOrderStatus.received,
          receipts: [],
        }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    prismaMock.$transaction.mockImplementation((cb) => cb(txMock));

    const updateIncomingSpy = jest.spyOn(
      service as unknown as {
        updateIncomingForProduct: (...args: unknown[]) => Promise<void>;
      },
      'updateIncomingForProduct',
    );
    updateIncomingSpy.mockResolvedValue(undefined);

    const result = await service.receivePurchaseOrder(1n, '5', {
      lines: [
        { purchaseOrderLineId: '10', productId: '11', receivedQty: '10' },
      ],
      locationCode: 'LOC-001',
      receivedAt: new Date().toString(),
    });

    expect(prismaMock.purchaseOrder.findUnique).toHaveBeenCalledWith({
      where: { id: 5n, accountId: 1n },
      include: { lines: true },
    });
    expect(inventoryServiceMock.postReceiptEvent).toHaveBeenCalledTimes(1);
    expect(updateIncomingSpy).toHaveBeenCalledTimes(1);
    expect(result?.status).toBe(PurchaseOrderStatus.received);
  });

  it('throws when received quantity exceeds ordered quantity', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: 5n,
      accountId: 1n,
      status: 'submitted',
      lines: [
        {
          id: 10n,
          productId: 11n,
          orderedQty: new Prisma.Decimal(10),
          receivedQty: new Prisma.Decimal(8),
        },
      ],
    });

    await expect(
      service.receivePurchaseOrder(1n, '5', {
        lines: [
          { purchaseOrderLineId: '10', productId: '11', receivedQty: '5' },
        ],
        locationCode: 'LOC-001',
        receivedAt: new Date().toString(),
      }),
    ).rejects.toThrow('exceeds remaining quantity');
  });

  it('throws when purchase order is not receivable - invalid status', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: 5n,
      accountId: 1n,
      status: PurchaseOrderStatus.draft,
      lines: [],
    });

    await expect(
      service.receivePurchaseOrder(1n, '5', {
        lines: [],
        locationCode: 'LOC-001',
        receivedAt: new Date().toString(),
      }),
    ).rejects.toThrow(
      'Only submitted or partially received purchase orders can be received',
    );
  });
});
