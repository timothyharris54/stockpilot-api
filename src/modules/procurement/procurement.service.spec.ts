import { Test, TestingModule } from '@nestjs/testing';
import {
  Prisma,
  PurchaseOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryBalanceService } from '../inventory/services/inventory-balance.service';
import { ProcurementService } from './procurement.service';

describe('ProcurementService', () => {
  let service: ProcurementService;
  let prismaMock: any;
  let txMock: any;
  let inventoryBalanceServiceMock: any;
  let inventoryServiceMock: any;

  function makePoLine(
    overrides: Partial<any> = {},
  ) {
    return {
      id: 10n,
      accountId: 1n,
      purchaseOrderId: 5n,
      productId: 11n,
      orderedQty: new Prisma.Decimal(10),
      receivedQty: new Prisma.Decimal(0),
      unitCost: new Prisma.Decimal('8.25'),
      ...overrides,
    };
  }

  function makePurchaseOrder(
    overrides: Partial<any> = {},
  ) {
    return {
      id: 5n,
      accountId: 1n,
      locationCode: 'MAIN',
      status: PurchaseOrderStatus.submitted,
      poNumber: 'PO-10001',
      lines: [],
      ...overrides,
    };
  }

  function buildTxMock() {
    return {
      receipt: {
        create: jest.fn(),
      },
      receiptLine: {
        create: jest.fn(),
      },
      inventoryLedger: {
        create: jest.fn(),
      },
      purchaseOrderLine: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrder: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
  }

  function buildPrismaMock(tx: any) {
    return {
      purchaseOrder: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    txMock = buildTxMock();
    prismaMock = buildPrismaMock(txMock);

    inventoryServiceMock = {};

    inventoryBalanceServiceMock = {
      recalculateInventoryBalanceForProduct: jest.fn(),
      recalculateInventoryBalancesForProducts: jest.fn(),
    };

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
        {
          provide: InventoryBalanceService,
          useValue: inventoryBalanceServiceMock,
        },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitPurchaseOrder', () => {
    it('submits a draft purchase order', async () => {
      const accountId = 1n;

      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: 5n,
        accountId,
        locationCode: 'MAIN',
        status: PurchaseOrderStatus.draft,
        lines: [{ productId: 11n }, { productId: 12n }],
      });

      const updatedPo = {
        id: 5n,
        locationCode: 'MAIN',
        vendor: {},
        lines: [
          { productId: 11n, product: {}, vendorProduct: null },
          { productId: 12n, product: {}, vendorProduct: null },
        ],
      };

      txMock.purchaseOrder.updateMany.mockResolvedValue({ count: 1 });
      txMock.purchaseOrder.findUnique.mockResolvedValue(updatedPo);

      const result = await service.submitPurchaseOrder(accountId, '5', 'MAIN');

      expect(prismaMock.purchaseOrder.findFirst).toHaveBeenCalledWith({
        where: { id: 5n, accountId, locationCode: 'MAIN' },
        select: {
          id: true,
          status: true,
          lines: true,
        },
      });

      expect(txMock.purchaseOrder.updateMany).toHaveBeenCalledWith({
        where: {
          id: 5n,
          accountId,
          locationCode: 'MAIN',
          status: PurchaseOrderStatus.draft,
        },
        data: {
          status: PurchaseOrderStatus.submitted,
          submittedAt: expect.any(Date),
          orderedAt: expect.any(Date),
        },
      });

      expect(txMock.purchaseOrder.findUnique).toHaveBeenCalledWith({
        where: { id: 5n },
        select: {
          id: true,
          locationCode: true,
          vendor: true,
          lines: {
            include: {
              product: true,
              vendorProduct: true,
            },
          },
        },
      });

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenNthCalledWith(1, accountId, 11n, 'MAIN', txMock);

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenNthCalledWith(2, accountId, 12n, 'MAIN', txMock);

      expect(result).toEqual(updatedPo);
    });
  });

  describe('receivePurchaseOrder', () => {
    it('receives partial quantities and sets status to partially_received', async () => {
      const accountId = 1n;

      prismaMock.purchaseOrder.findFirst.mockResolvedValue(
        makePurchaseOrder({
          id: 5n,
          accountId,
          locationCode: 'MAIN',
          status: PurchaseOrderStatus.submitted,
          lines: [
            makePoLine({
              id: 10n,
              purchaseOrderId: 5n,
              productId: 11n,
              orderedQty: new Prisma.Decimal(10),
              receivedQty: new Prisma.Decimal(0),
              unitCost: new Prisma.Decimal('8.25'),
            }),
          ],
        }),
      );

      txMock.receipt.create.mockResolvedValue({
        id: 100n,
        lines: [],
      });

      txMock.purchaseOrderLine.findMany.mockResolvedValue([
        makePoLine({
          id: 10n,
          accountId,
          purchaseOrderId: 5n,
          productId: 11n,
          orderedQty: new Prisma.Decimal(10),
          receivedQty: new Prisma.Decimal(0),
          unitCost: new Prisma.Decimal('8.25'),
        }),
      ]);

      txMock.purchaseOrderLine.update.mockResolvedValue({});
      txMock.receiptLine.create.mockResolvedValue({ id: 200n });
      txMock.inventoryLedger.create.mockResolvedValue({ id: 300n });

      // 👇 Not fully received → should stay partial
      txMock.purchaseOrder.findUnique.mockResolvedValue({
        id: 5n,
        vendor: {},
        lines: [
          {
            id: 10n,
            orderedQty: new Prisma.Decimal(10),
            receivedQty: new Prisma.Decimal(4), // partial
          },
        ],
      });

      txMock.purchaseOrder.update.mockResolvedValue({
        id: 5n,
        accountId,
        locationCode: 'MAIN',
        status: PurchaseOrderStatus.partially_received,
        poNumber: 'PO-10001',
        vendor: {},
        lines: [
          {
            id: 10n,
            productId: 11n,
            orderedQty: new Prisma.Decimal(10),
            receivedQty: new Prisma.Decimal(4),
            unitCost: new Prisma.Decimal('8.25'),
            product: {},
            vendorProduct: null,
          },
        ],
      });

      const result = await service.receivePurchaseOrder(accountId, '5', {
        lines: [{ purchaseOrderLineId: '10', receivedQty: '4' }],
        receivedAt: new Date().toISOString(),
        notes: 'Partial receipt',
      } as any);

      expect(txMock.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: {
          status: PurchaseOrderStatus.partially_received,
        },
        include: {
          vendor: true,
          lines: {
            include: {
              product: true,
              vendorProduct: true,
            },
          },
        },
      });

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledTimes(1);

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledWith(1n, 11n, 'MAIN', txMock);

      expect(result.status).toBe(PurchaseOrderStatus.partially_received);
    });    

    it('receives all quantities and sets status to received', async () => {
      const accountId = 1n;

      prismaMock.purchaseOrder.findFirst.mockResolvedValue(
        makePurchaseOrder({
          id: 5n,
          accountId,
          locationCode: 'MAIN',
          status: PurchaseOrderStatus.submitted,
          lines: [
            makePoLine({
              id: 10n,
              purchaseOrderId: 5n,
              productId: 11n,
              orderedQty: new Prisma.Decimal(10),
              receivedQty: new Prisma.Decimal(0),
              unitCost: new Prisma.Decimal('8.25'),
            }),
          ],
        }),
      );

      txMock.receipt.create.mockResolvedValue({
        id: 100n,
        lines: [],
      });

      txMock.purchaseOrderLine.findMany.mockResolvedValue([
        makePoLine({
          id: 10n,
          accountId,
          purchaseOrderId: 5n,
          productId: 11n,
          orderedQty: new Prisma.Decimal(10),
          receivedQty: new Prisma.Decimal(0),
          unitCost: new Prisma.Decimal('8.25'),
        }),
      ]);

      txMock.purchaseOrderLine.update.mockResolvedValue({});
      txMock.receiptLine.create.mockResolvedValue({ id: 200n });
      txMock.inventoryLedger.create.mockResolvedValue({ id: 300n });

      txMock.purchaseOrder.findUnique.mockResolvedValue({
        id: 5n,
        vendor: {},
        lines: [
          {
            id: 10n,
            orderedQty: new Prisma.Decimal(10),
            receivedQty: new Prisma.Decimal(10),
          },
        ],
      });

      txMock.purchaseOrder.update.mockResolvedValue({
        id: 5n,
        accountId,
        locationCode: 'MAIN',
        status: PurchaseOrderStatus.received,
        poNumber: 'PO-10001',
        vendor: {},
        lines: [
          {
            id: 10n,
            productId: 11n,
            orderedQty: new Prisma.Decimal(10),
            receivedQty: new Prisma.Decimal(10),
            unitCost: new Prisma.Decimal('8.25'),
            product: {},
            vendorProduct: null,
          },
        ],
      });

      const result = await service.receivePurchaseOrder(accountId, '5', {
        lines: [{ purchaseOrderLineId: '10', receivedQty: '10' }],
        receivedAt: new Date().toISOString(),
        notes: 'Full receipt',
      } as any);

      expect(prismaMock.purchaseOrder.findFirst).toHaveBeenCalledWith({
        where: { id: 5n, accountId },
        select: {
          id: true,
          locationCode: true,
          status: true,
          poNumber: true,
          lines: true,
        },
      });

      expect(txMock.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: {
          status: PurchaseOrderStatus.received,
        },
        include: {
          vendor: true,
          lines: {
            include: {
              product: true,
              vendorProduct: true,
            },
          },
        },
      });

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledTimes(1);

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledWith(1n, 11n, 'MAIN', txMock);

      expect(result.status).toBe(PurchaseOrderStatus.received);
    });

    it('rejects receive from invalid status', async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(
        makePurchaseOrder({
          id: 5n,
          accountId: 1n,
          locationCode: 'MAIN',
          status: PurchaseOrderStatus.draft,
          lines: [],
        }),
      );

      await expect(
        service.receivePurchaseOrder(1n, '5', {
          lines: [],
          receivedAt: new Date().toISOString(),
        } as any),
      ).rejects.toThrow(
        'Purchase order cannot be received from status draft.',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects over receipt', async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(
        makePurchaseOrder({
          id: 5n,
          accountId: 1n,
          locationCode: 'MAIN',
          status: PurchaseOrderStatus.submitted,
          lines: [
            makePoLine({
              id: 10n,
              purchaseOrderId: 5n,
              productId: 11n,
              orderedQty: new Prisma.Decimal(10),
              receivedQty: new Prisma.Decimal(8),
            }),
          ],
        }),
      );

      txMock.receipt.create.mockResolvedValue({ id: 100n });

      txMock.purchaseOrderLine.findMany.mockResolvedValue([
        makePoLine({
          id: 10n,
          accountId: 1n,
          purchaseOrderId: 5n,
          productId: 11n,
          orderedQty: new Prisma.Decimal(10),
          receivedQty: new Prisma.Decimal(8),
          unitCost: new Prisma.Decimal('8.25'),
        }),
      ]);

      txMock.purchaseOrderLine.findFirst.mockResolvedValue(
        makePoLine({
          id: 10n,
          accountId: 1n,
          purchaseOrderId: 5n,
          productId: 11n,
          orderedQty: new Prisma.Decimal(10),
          receivedQty: new Prisma.Decimal(8),
          unitCost: new Prisma.Decimal('8.25'),
        }),
      );

      await expect(
        service.receivePurchaseOrder(1n, '5', {
          lines: [{ purchaseOrderLineId: '10', receivedQty: '5' }],
          receivedAt: new Date().toISOString(),
        } as any),
      ).rejects.toThrow(
        'Received quantity exceeds ordered quantity for line 10.',
      );

      expect(txMock.purchaseOrderLine.update).not.toHaveBeenCalled();
      expect(txMock.receiptLine.create).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).not.toHaveBeenCalled();
    });

    it('recalculates inventory balance once per unique touched product', async () => {
      const accountId = 1n;
      const purchaseOrderId = '5';

      const dto = {
        receivedAt: new Date().toISOString(),
        notes: 'Partial receipt',
        lines: [
          { purchaseOrderLineId: '101', receivedQty: '5' },
          { purchaseOrderLineId: '102', receivedQty: '3' },
          { purchaseOrderLineId: '103', receivedQty: '2' },
        ],
      };

      prismaMock.purchaseOrder.findFirst.mockResolvedValue(
        makePurchaseOrder({
          id: 5n,
          accountId,
          locationCode: 'MAIN',
          status: PurchaseOrderStatus.submitted,
        }),
      );

      txMock.receipt.create.mockResolvedValue({
        id: 100n,
        lines: [],
      });

      txMock.purchaseOrderLine.findMany.mockResolvedValue([
        makePoLine({
          id: 101n,
          accountId,
          purchaseOrderId: 5n,
          productId: 11n,
          orderedQty: new Prisma.Decimal(10),
          receivedQty: new Prisma.Decimal(1),
          unitCost: new Prisma.Decimal('5.25'),
        }),
        makePoLine({
          id: 102n,
          accountId,
          purchaseOrderId: 5n,
          productId: 11n,
          orderedQty: new Prisma.Decimal(8),
          receivedQty: new Prisma.Decimal(0),
          unitCost: new Prisma.Decimal('5.25'),
        }),
        makePoLine({
          id: 103n,
          accountId,
          purchaseOrderId: 5n,
          productId: 12n,
          orderedQty: new Prisma.Decimal(20),
          receivedQty: new Prisma.Decimal(5),
          unitCost: new Prisma.Decimal('7.50'),
        }),
      ]);

      txMock.purchaseOrderLine.findFirst
        .mockResolvedValueOnce(
          makePoLine({
            id: 101n,
            accountId,
            purchaseOrderId: 5n,
            productId: 11n,
            orderedQty: new Prisma.Decimal(10),
            receivedQty: new Prisma.Decimal(1),
            unitCost: new Prisma.Decimal('5.25'),
          }),
        )
        .mockResolvedValueOnce(
          makePoLine({
            id: 102n,
            accountId,
            purchaseOrderId: 5n,
            productId: 11n,
            orderedQty: new Prisma.Decimal(8),
            receivedQty: new Prisma.Decimal(0),
            unitCost: new Prisma.Decimal('5.25'),
          }),
        )
        .mockResolvedValueOnce(
          makePoLine({
            id: 103n,
            accountId,
            purchaseOrderId: 5n,
            productId: 12n,
            orderedQty: new Prisma.Decimal(20),
            receivedQty: new Prisma.Decimal(5),
            unitCost: new Prisma.Decimal('7.50'),
          }),
        );

      txMock.purchaseOrderLine.update.mockResolvedValue({});
      txMock.receiptLine.create.mockResolvedValue({});
      txMock.inventoryLedger.create.mockResolvedValue({});

      txMock.purchaseOrder.findUnique.mockResolvedValue({
        id: 5n,
        vendor: { id: 77n, name: 'Vendor A' },
        lines: [
          {
            id: 101n,
            orderedQty: new Prisma.Decimal(10),
            receivedQty: new Prisma.Decimal(6),
          },
          {
            id: 102n,
            orderedQty: new Prisma.Decimal(8),
            receivedQty: new Prisma.Decimal(3),
          },
          {
            id: 103n,
            orderedQty: new Prisma.Decimal(20),
            receivedQty: new Prisma.Decimal(7),
          },
        ],
      });

      txMock.purchaseOrder.update.mockResolvedValue({
        id: 5n,
        status: PurchaseOrderStatus.partially_received,
        vendor: { id: 77n, name: 'Vendor A' },
        lines: [],
      });

      inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct.mockResolvedValue({});

      await service.receivePurchaseOrder(accountId, purchaseOrderId, dto as any);

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledTimes(2);

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenNthCalledWith(1, accountId, 11n, 'MAIN', txMock);

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenNthCalledWith(2, accountId, 12n, 'MAIN', txMock);
    });
  });

  
});
