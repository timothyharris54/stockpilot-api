import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, RecommendationStatus, VendorProduct } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RecommendationConversionService } from './recommendation-conversion.service';
import { VendorProductSelectorService } from './vendor-product-selector.service';

describe('RecommendationConversionService', () => {
  let service: RecommendationConversionService;

  const txMock = {
    account: {
      update: jest.fn(),
    },
    purchaseOrder: {
      create: jest.fn(),
    },
    purchaseOrderLine: {
      create: jest.fn(),
    },
    vendorProduct: {
      findMany: jest.fn(),
    },
    reorderRecommendation: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const prismaMock = {
    reorderRecommendation: {
      findMany: jest.fn(),
    },
    vendorProduct: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const vendorProductSelectorMock = {
    select: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof txMock) => unknown) => callback(txMock),
    );
    txMock.reorderRecommendation.findMany.mockImplementation(
      prismaMock.reorderRecommendation.findMany,
    );
    txMock.vendorProduct.findMany.mockImplementation(
      prismaMock.vendorProduct.findMany,
    );
    vendorProductSelectorMock.select.mockImplementation(
      (vendorProducts: VendorProduct[]) => {
        return vendorProducts[0] ?? null;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationConversionService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: VendorProductSelectorService,
          useValue: vendorProductSelectorMock,
        },
      ],
    }).compile();

    service = module.get<RecommendationConversionService>(
      RecommendationConversionService,
    );
  });

  describe('convertRecommendations', () => {
    it('converts two recommendations for the same vendor into one purchase order with two lines', async () => {
      const accountId = 1n;

      const recommendation1 = {
        id: 101n,
        accountId,
        productId: 11n,
        status: RecommendationStatus.open,
        recommendedQty: new Prisma.Decimal(5),
        product: {
          id: 11n,
          sku: 'WB-100',
          name: 'Widget Basic',
        },
      };

      const recommendation2 = {
        id: 102n,
        accountId,
        productId: 12n,
        status: RecommendationStatus.reviewed,
        recommendedQty: new Prisma.Decimal(7),
        product: {
          id: 12n,
          sku: 'WP-200',
          name: 'Widget Pro',
        },
      };

      prismaMock.reorderRecommendation.findMany.mockResolvedValue([
        recommendation1,
        recommendation2,
      ]);

      const vendorProductsForRec1 = [
        {
          id: 201n,
          accountId,
          vendorId: 501n,
          productId: 11n,
          unitCost: new Prisma.Decimal('8.25'),
          minOrderQty: new Prisma.Decimal('12'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ];

      const vendorProductsForRec2 = [
        {
          id: 202n,
          accountId,
          vendorId: 501n,
          productId: 12n,
          unitCost: new Prisma.Decimal('13.75'),
          minOrderQty: new Prisma.Decimal('6'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ];

      prismaMock.vendorProduct.findMany
        .mockResolvedValueOnce(vendorProductsForRec1)
        .mockResolvedValueOnce(vendorProductsForRec2);

      vendorProductSelectorMock.select
        .mockReturnValueOnce(vendorProductsForRec1[0])
        .mockReturnValueOnce(vendorProductsForRec2[0]);

      txMock.account.update.mockResolvedValue({
        nextPurchaseOrderNumber: 2,
      });

      txMock.purchaseOrder.create.mockResolvedValue({
        id: 9001n,
        accountId,
        vendorId: 501n,
        poNumber: 'PO-000001',
        status: 'draft',
      });

      txMock.purchaseOrderLine.create
        .mockResolvedValueOnce({
          id: 9101n,
          purchaseOrderId: 9001n,
          productId: 11n,
        })
        .mockResolvedValueOnce({
          id: 9102n,
          purchaseOrderId: 9001n,
          productId: 12n,
        });

      txMock.reorderRecommendation.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      const result = await service.convertRecommendations({
        accountId,
        recommendations: [
          { recommendationId: '101', vendorId: '501', quantity: '5' },
          { recommendationId: '102', vendorId: '501', quantity: '7' },
        ],
      });

      expect(prismaMock.reorderRecommendation.findMany).toHaveBeenCalledWith({
        where: {
          accountId,
          id: { in: [101n, 102n] },
          status: { in: ['open', 'reviewed'] },
        },
        select: {
          id: true,
          productId: true,
          recommendedQty: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      expect(prismaMock.vendorProduct.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          accountId,
          productId: 11n,
          vendorId: 501n,
          isActive: true,
        },
        orderBy: [{ isPrimaryVendor: 'desc' }, { id: 'asc' }],
      });

      expect(prismaMock.vendorProduct.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          accountId,
          productId: 12n,
          vendorId: 501n,
          isActive: true,
        },
        orderBy: [{ isPrimaryVendor: 'desc' }, { id: 'asc' }],
      });

      expect(txMock.purchaseOrder.create).toHaveBeenCalledTimes(1);
      expect(txMock.purchaseOrder.create).toHaveBeenCalledWith({
        data: {
          accountId,
          vendorId: 501n,
          poNumber: 'PO-000001',
          status: 'draft',
        },
      });

      expect(txMock.purchaseOrderLine.create).toHaveBeenCalledTimes(2);

      expect(txMock.purchaseOrderLine.create).toHaveBeenNthCalledWith(1, {
        data: {
          accountId,
          purchaseOrderId: 9001n,
          productId: 11n,
          vendorProductId: 201n,
          orderedQty: new Prisma.Decimal(12),
          unitCost: new Prisma.Decimal('8.25'),
          lineTotal: new Prisma.Decimal('99.00'),
        },
      });

      expect(txMock.purchaseOrderLine.create).toHaveBeenNthCalledWith(2, {
        data: {
          accountId,
          purchaseOrderId: 9001n,
          productId: 12n,
          vendorProductId: 202n,
          orderedQty: new Prisma.Decimal(12),
          unitCost: new Prisma.Decimal('13.75'),
          lineTotal: new Prisma.Decimal('165.00'),
        },
      });

      expect(txMock.reorderRecommendation.updateMany).toHaveBeenCalledTimes(2);

      expect(txMock.reorderRecommendation.updateMany).toHaveBeenNthCalledWith(
        1,
        {
          where: {
            accountId,
            id: 101n,
            status: { in: ['open', 'reviewed'] },
            purchaseOrderId: null,
            purchaseOrderLineId: null,
          },
          data: {
            status: RecommendationStatus.converted,
            vendorId: 501n,
            vendorProductId: 201n,
            purchaseOrderId: 9001n,
            purchaseOrderLineId: 9101n,
            finalQty: new Prisma.Decimal(12),
            convertedAt: expect.any(Date) as Date,
          },
        },
      );

      expect(txMock.reorderRecommendation.updateMany).toHaveBeenNthCalledWith(
        2,
        {
          where: {
            accountId,
            id: 102n,
            status: { in: ['open', 'reviewed'] },
            purchaseOrderId: null,
            purchaseOrderLineId: null,
          },
          data: {
            status: RecommendationStatus.converted,
            vendorId: 501n,
            vendorProductId: 202n,
            purchaseOrderId: 9001n,
            purchaseOrderLineId: 9102n,
            finalQty: new Prisma.Decimal(12),
            convertedAt: expect.any(Date) as Date,
          },
        },
      );

      expect(result).toEqual({
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
      });
    });

    it('converts two recommendations for different vendors into two purchase orders with one line each', async () => {
      const accountId = 1n;

      const recommendation1 = {
        id: 101n,
        accountId,
        productId: 11n,
        status: RecommendationStatus.open,
        recommendedQty: new Prisma.Decimal(5),
        product: {
          id: 11n,
          sku: 'WB-100',
          name: 'Widget Basic',
        },
      };

      const recommendation2 = {
        id: 102n,
        accountId,
        productId: 12n,
        status: RecommendationStatus.reviewed,
        recommendedQty: new Prisma.Decimal(7),
        product: {
          id: 12n,
          sku: 'WP-200',
          name: 'Widget Pro',
        },
      };

      prismaMock.reorderRecommendation.findMany.mockResolvedValue([
        recommendation1,
        recommendation2,
      ]);

      const vendorProductsForRec1 = [
        {
          id: 201n,
          accountId,
          vendorId: 501n,
          productId: 11n,
          unitCost: new Prisma.Decimal('8.25'),
          minOrderQty: new Prisma.Decimal('12'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ];

      const vendorProductsForRec2 = [
        {
          id: 202n,
          accountId,
          vendorId: 502n,
          productId: 12n,
          unitCost: new Prisma.Decimal('13.75'),
          minOrderQty: new Prisma.Decimal('6'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ];

      prismaMock.vendorProduct.findMany
        .mockResolvedValueOnce(vendorProductsForRec1)
        .mockResolvedValueOnce(vendorProductsForRec2);

      vendorProductSelectorMock.select
        .mockReturnValueOnce(vendorProductsForRec1[0])
        .mockReturnValueOnce(vendorProductsForRec2[0]);

      txMock.account.update
        .mockResolvedValueOnce({
          nextPurchaseOrderNumber: 2,
        })
        .mockResolvedValueOnce({
          nextPurchaseOrderNumber: 3,
        });

      txMock.purchaseOrder.create
        .mockResolvedValueOnce({
          id: 9001n,
          accountId,
          vendorId: 501n,
          poNumber: 'PO-000001',
          status: 'draft',
        })
        .mockResolvedValueOnce({
          id: 9002n,
          accountId,
          vendorId: 502n,
          poNumber: 'PO-000002',
          status: 'draft',
        });

      txMock.purchaseOrderLine.create
        .mockResolvedValueOnce({
          id: 9101n,
          purchaseOrderId: 9001n,
          productId: 11n,
        })
        .mockResolvedValueOnce({
          id: 9102n,
          purchaseOrderId: 9002n,
          productId: 12n,
        });

      txMock.reorderRecommendation.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      const result = await service.convertRecommendations({
        accountId,
        recommendations: [
          { recommendationId: '101', vendorId: '501', quantity: '5' },
          { recommendationId: '102', vendorId: '502', quantity: '7' },
        ],
      });

      expect(prismaMock.reorderRecommendation.findMany).toHaveBeenCalledWith({
        where: {
          accountId,
          id: { in: [101n, 102n] },
          status: { in: ['open', 'reviewed'] },
        },
        select: {
          id: true,
          productId: true,
          recommendedQty: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      expect(txMock.purchaseOrder.create).toHaveBeenCalledTimes(2);

      expect(txMock.purchaseOrder.create).toHaveBeenNthCalledWith(1, {
        data: {
          accountId,
          vendorId: 501n,
          poNumber: 'PO-000001',
          status: 'draft',
        },
      });

      expect(txMock.purchaseOrder.create).toHaveBeenNthCalledWith(2, {
        data: {
          accountId,
          vendorId: 502n,
          poNumber: 'PO-000002',
          status: 'draft',
        },
      });

      expect(txMock.purchaseOrderLine.create).toHaveBeenCalledTimes(2);

      expect(txMock.purchaseOrderLine.create).toHaveBeenNthCalledWith(1, {
        data: {
          accountId,
          purchaseOrderId: 9001n,
          productId: 11n,
          vendorProductId: 201n,
          orderedQty: new Prisma.Decimal(12),
          unitCost: new Prisma.Decimal('8.25'),
          lineTotal: new Prisma.Decimal('99.00'),
        },
      });

      expect(txMock.purchaseOrderLine.create).toHaveBeenNthCalledWith(2, {
        data: {
          accountId,
          purchaseOrderId: 9002n,
          productId: 12n,
          vendorProductId: 202n,
          orderedQty: new Prisma.Decimal(12),
          unitCost: new Prisma.Decimal('13.75'),
          lineTotal: new Prisma.Decimal('165.00'),
        },
      });

      expect(txMock.reorderRecommendation.updateMany).toHaveBeenNthCalledWith(
        1,
        {
          where: {
            accountId,
            id: 101n,
            status: { in: ['open', 'reviewed'] },
            purchaseOrderId: null,
            purchaseOrderLineId: null,
          },
          data: {
            status: RecommendationStatus.converted,
            vendorId: 501n,
            vendorProductId: 201n,
            purchaseOrderId: 9001n,
            purchaseOrderLineId: 9101n,
            finalQty: new Prisma.Decimal(12),
            convertedAt: expect.any(Date) as Date,
          },
        },
      );

      expect(txMock.reorderRecommendation.updateMany).toHaveBeenNthCalledWith(
        2,
        {
          where: {
            accountId,
            id: 102n,
            status: { in: ['open', 'reviewed'] },
            purchaseOrderId: null,
            purchaseOrderLineId: null,
          },
          data: {
            status: RecommendationStatus.converted,
            vendorId: 502n,
            vendorProductId: 202n,
            purchaseOrderId: 9002n,
            purchaseOrderLineId: 9102n,
            finalQty: new Prisma.Decimal(12),
            convertedAt: expect.any(Date) as Date,
          },
        },
      );

      expect(result).toEqual({
        createdPurchaseOrders: 2,
        convertedRecommendations: 2,
        purchaseOrders: [
          {
            purchaseOrderId: '9001',
            vendorId: '501',
            lineCount: 1,
            totalOrderedQty: '12',
            totalCost: '99.00',
          },
          {
            purchaseOrderId: '9002',
            vendorId: '502',
            lineCount: 1,
            totalOrderedQty: '12',
            totalCost: '165.00',
          },
        ],
      });
    });

    it('previews recommendations as grouped vendor summary data', async () => {
      const accountId = 1n;

      prismaMock.reorderRecommendation.findMany.mockResolvedValue([
        {
          id: 101n,
          accountId,
          productId: 11n,
          vendorId: null,
          vendorProductId: null,
          status: RecommendationStatus.open,
          recommendedQty: new Prisma.Decimal(5),
          finalQty: null,
          unitCost: null,
          product: {
            id: 11n,
            sku: 'WB-100',
            name: 'Widget Basic',
          },
        },
      ]);

      prismaMock.vendorProduct.findMany.mockResolvedValue([
        {
          id: 201n,
          accountId,
          vendorId: 501n,
          productId: 11n,
          unitCost: new Prisma.Decimal('8.25'),
          minOrderQty: new Prisma.Decimal('12'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ]);

      vendorProductSelectorMock.select.mockReturnValue({
        id: 201n,
        vendorId: 501n,
        unitCost: new Prisma.Decimal('8.25'),
        minOrderQty: new Prisma.Decimal('12'),
        orderMultiple: new Prisma.Decimal('6'),
      });

      const result = await service.previewRecommendations({
        accountId,
        recommendations: [
          { recommendationId: '101', vendorId: '501', quantity: '5' },
        ],
      });

      expect(result).toEqual({
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
      });

      expect(prismaMock.reorderRecommendation.findMany).toHaveBeenCalledTimes(
        1,
      );
      expect(prismaMock.vendorProduct.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('uses requested quantity when calculating preview final quantity', async () => {
      const accountId = 1n;

      prismaMock.reorderRecommendation.findMany.mockResolvedValue([
        {
          id: 101n,
          accountId,
          productId: 11n,
          status: RecommendationStatus.open,
          recommendedQty: new Prisma.Decimal(5),
        },
      ]);

      prismaMock.vendorProduct.findMany.mockResolvedValue([
        {
          id: 201n,
          accountId,
          vendorId: 501n,
          productId: 11n,
          unitCost: new Prisma.Decimal('8.25'),
          minOrderQty: new Prisma.Decimal('12'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ]);

      vendorProductSelectorMock.select.mockReturnValue({
        id: 201n,
        vendorId: 501n,
        unitCost: new Prisma.Decimal('8.25'),
        minOrderQty: new Prisma.Decimal('12'),
        orderMultiple: new Prisma.Decimal('6'),
      });

      const result = await service.previewRecommendations({
        accountId,
        recommendations: [
          { recommendationId: '101', vendorId: '501', quantity: '13' },
        ],
      });

      expect(result.vendorGroups[0].totalOrderedQty).toBe('18');
      expect(result.vendorGroups[0].totalCost).toBe('148.50');
      expect(result.vendorGroups[0].lines[0].recommendedQty).toBe('5');
      expect(result.vendorGroups[0].lines[0].finalQty).toBe('18');
    });

    it('fails when a recommendation cannot be updated due to concurrent modification', async () => {
      const accountId = 1n;

      prismaMock.reorderRecommendation.findMany.mockResolvedValue([
        {
          id: 101n,
          accountId,
          productId: 11n,
          status: RecommendationStatus.open,
          recommendedQty: new Prisma.Decimal(5),
          product: {
            id: 11n,
            sku: 'WB-100',
            name: 'Widget Basic',
          },
        },
      ]);

      prismaMock.vendorProduct.findMany.mockResolvedValue([
        {
          id: 201n,
          accountId,
          vendorId: 501n,
          productId: 11n,
          unitCost: new Prisma.Decimal('8.25'),
          minOrderQty: new Prisma.Decimal('12'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ]);

      vendorProductSelectorMock.select.mockReturnValue({
        id: 201n,
        vendorId: 501n,
        unitCost: new Prisma.Decimal('8.25'),
        minOrderQty: new Prisma.Decimal('12'),
        orderMultiple: new Prisma.Decimal('6'),
      });

      txMock.account.update.mockResolvedValue({
        nextPurchaseOrderNumber: 2,
      });

      txMock.purchaseOrder.create.mockResolvedValue({
        id: 9001n,
        accountId,
        vendorId: 501n,
        poNumber: 'PO-000001',
        status: 'draft',
      });

      txMock.purchaseOrderLine.create.mockResolvedValue({
        id: 9101n,
        purchaseOrderId: 9001n,
        productId: 11n,
      });

      txMock.reorderRecommendation.updateMany.mockResolvedValue({
        count: 0,
      });

      try {
        await service.convertRecommendations({
          accountId,
          recommendations: [
            { recommendationId: '101', vendorId: '501', quantity: '5' },
          ],
        });
        fail('Expected convertRecommendations to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'Recommendation 101 could not be converted due to a concurrent update or invalid state.',
        );
      }

      expect(txMock.purchaseOrder.create).toHaveBeenCalledTimes(1);
      expect(txMock.purchaseOrderLine.create).toHaveBeenCalledTimes(1);
      expect(txMock.reorderRecommendation.updateMany).toHaveBeenCalledTimes(1);
    });

    it('fails when duplicate recommendationIds are provided', async () => {
      const accountId = 1n;

      try {
        await service.convertRecommendations({
          accountId,
          recommendations: [
            { recommendationId: '101', vendorId: '501', quantity: '5' },
            { recommendationId: '101', vendorId: '501', quantity: '7' },
          ],
        });
        fail('Expected convertRecommendations to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'Duplicate recommendationIds are not allowed.',
        );
      }

      expect(prismaMock.reorderRecommendation.findMany).not.toHaveBeenCalled();
      expect(prismaMock.vendorProduct.findMany).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.purchaseOrder.create).not.toHaveBeenCalled();
      expect(txMock.purchaseOrderLine.create).not.toHaveBeenCalled();
      expect(txMock.reorderRecommendation.updateMany).not.toHaveBeenCalled();
    });

    it('fails when no vendor product can be resolved', async () => {
      const accountId = 1n;

      prismaMock.reorderRecommendation.findMany.mockResolvedValue([
        {
          id: 101n,
          accountId,
          productId: 11n,
          status: RecommendationStatus.open,
          recommendedQty: new Prisma.Decimal(5),
          product: {
            id: 11n,
            sku: 'WB-100',
            name: 'Widget Basic',
          },
        },
      ]);

      prismaMock.vendorProduct.findMany.mockResolvedValue([
        {
          id: 201n,
          accountId,
          vendorId: 501n,
          productId: 11n,
          unitCost: new Prisma.Decimal('8.25'),
          minOrderQty: new Prisma.Decimal('12'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: false,
          isActive: true,
        },
        {
          id: 202n,
          accountId,
          vendorId: 502n,
          productId: 11n,
          unitCost: new Prisma.Decimal('8.10'),
          minOrderQty: new Prisma.Decimal('12'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: false,
          isActive: true,
        },
      ]);

      // Simulate selector failing to choose a single vendor product
      vendorProductSelectorMock.select.mockReturnValue(null);

      try {
        await service.convertRecommendations({
          accountId,
          recommendations: [
            { recommendationId: '101', vendorId: '501', quantity: '5' },
          ],
        });
        fail('Expected convertRecommendations to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'Unable to resolve a vendor product for recommendation 101 (product 11, vendor 501).',
        );
      }

      expect(prismaMock.reorderRecommendation.findMany).toHaveBeenCalledTimes(
        1,
      );
      expect(prismaMock.vendorProduct.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      expect(txMock.purchaseOrder.create).not.toHaveBeenCalled();
      expect(txMock.purchaseOrderLine.create).not.toHaveBeenCalled();
      expect(txMock.reorderRecommendation.updateMany).not.toHaveBeenCalled();
    });

    it('fails when one or more recommendations are not found or not convertible', async () => {
      const accountId = 1n;

      // Request two IDs, but only one valid/convertible recommendation comes back
      prismaMock.reorderRecommendation.findMany.mockResolvedValue([
        {
          id: 101n,
          accountId,
          productId: 11n,
          status: RecommendationStatus.open,
          recommendedQty: new Prisma.Decimal(5),
          product: {
            id: 11n,
            sku: 'WB-100',
            name: 'Widget Basic',
          },
        },
      ]);

      try {
        await service.convertRecommendations({
          accountId,
          recommendations: [
            { recommendationId: '101', vendorId: '501', quantity: '5' },
            { recommendationId: '102', vendorId: '501', quantity: '7' },
          ],
        });
        fail('Expected convertRecommendations to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as NotFoundException).message).toBe(
          'One or more recommendations were not found, do not belong to this account, or are not convertible.',
        );
      }

      expect(prismaMock.reorderRecommendation.findMany).toHaveBeenCalledTimes(
        1,
      );
      expect(prismaMock.vendorProduct.findMany).not.toHaveBeenCalled();
      expect(vendorProductSelectorMock.select).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      expect(txMock.purchaseOrder.create).not.toHaveBeenCalled();
      expect(txMock.purchaseOrderLine.create).not.toHaveBeenCalled();
      expect(txMock.reorderRecommendation.updateMany).not.toHaveBeenCalled();
    });

    it('fails when requested quantity is zero or less', async () => {
      const accountId = 1n;

      try {
        await service.convertRecommendations({
          accountId,
          recommendations: [
            { recommendationId: '101', vendorId: '501', quantity: '0' },
          ],
        });
        fail('Expected convertRecommendations to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'Quantity must be greater than zero for recommendation 101.',
        );
      }

      expect(prismaMock.reorderRecommendation.findMany).not.toHaveBeenCalled();
      expect(prismaMock.vendorProduct.findMany).not.toHaveBeenCalled();
      expect(vendorProductSelectorMock.select).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.purchaseOrder.create).not.toHaveBeenCalled();
      expect(txMock.purchaseOrderLine.create).not.toHaveBeenCalled();
      expect(txMock.reorderRecommendation.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('previewRecommendations', () => {
    // happy paths
    it('previews two recommendations for the same vendor as one vendor group without writing data', async () => {
      const accountId = 1n;

      prismaMock.reorderRecommendation.findMany.mockResolvedValue([
        {
          id: 101n,
          accountId,
          productId: 11n,
          status: RecommendationStatus.open,
          recommendedQty: new Prisma.Decimal(5),
          product: {
            id: 11n,
            sku: 'WB-100',
            name: 'Widget Basic',
          },
        },
        {
          id: 102n,
          accountId,
          productId: 12n,
          status: RecommendationStatus.reviewed,
          recommendedQty: new Prisma.Decimal(7),
          product: {
            id: 12n,
            sku: 'WP-200',
            name: 'Widget Pro',
          },
        },
      ]);

      const vendorProductsForRec1 = [
        {
          id: 201n,
          accountId,
          vendorId: 501n,
          productId: 11n,
          unitCost: new Prisma.Decimal('8.25'),
          minOrderQty: new Prisma.Decimal('12'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ];

      const vendorProductsForRec2 = [
        {
          id: 202n,
          accountId,
          vendorId: 501n,
          productId: 12n,
          unitCost: new Prisma.Decimal('13.75'),
          minOrderQty: new Prisma.Decimal('6'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ];

      prismaMock.vendorProduct.findMany
        .mockResolvedValueOnce(vendorProductsForRec1)
        .mockResolvedValueOnce(vendorProductsForRec2);

      vendorProductSelectorMock.select
        .mockReturnValueOnce(vendorProductsForRec1[0])
        .mockReturnValueOnce(vendorProductsForRec2[0]);

      const result = await service.previewRecommendations({
        accountId,
        recommendations: [
          { recommendationId: '101', vendorId: '501', quantity: '5' },
          { recommendationId: '102', vendorId: '501', quantity: '7' },
        ],
      });

      expect(prismaMock.reorderRecommendation.findMany).toHaveBeenCalledWith({
        where: {
          accountId,
          id: { in: [101n, 102n] },
          status: { in: ['open', 'reviewed'] },
        },
        select: {
          id: true,
          productId: true,
          recommendedQty: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      expect(prismaMock.vendorProduct.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          accountId,
          productId: 11n,
          vendorId: 501n,
          isActive: true,
        },
        orderBy: [{ isPrimaryVendor: 'desc' }, { id: 'asc' }],
      });

      expect(prismaMock.vendorProduct.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          accountId,
          productId: 12n,
          vendorId: 501n,
          isActive: true,
        },
        orderBy: [{ isPrimaryVendor: 'desc' }, { id: 'asc' }],
      });

      expect(result).toEqual({
        vendorGroups: [
          {
            vendorId: '501',
            lineCount: 2,
            totalOrderedQty: '24',
            totalCost: '264.00',
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
              {
                recommendationId: '102',
                productId: '12',
                vendorProductId: '202',
                recommendedQty: '7',
                finalQty: '12',
                unitCost: '13.75',
                lineTotal: '165.00',
              },
            ],
          },
        ],
        totalGroups: 1,
        totalRecommendations: 2,
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.purchaseOrder.create).not.toHaveBeenCalled();
      expect(txMock.purchaseOrderLine.create).not.toHaveBeenCalled();
      expect(txMock.reorderRecommendation.updateMany).not.toHaveBeenCalled();
    });

    it('previews two recommendations for different vendors as two vendor groups without writing data', async () => {
      const accountId = 1n;

      prismaMock.reorderRecommendation.findMany.mockResolvedValue([
        {
          id: 101n,
          accountId,
          productId: 11n,
          status: RecommendationStatus.open,
          recommendedQty: new Prisma.Decimal(5),
        },
        {
          id: 102n,
          accountId,
          productId: 12n,
          status: RecommendationStatus.reviewed,
          recommendedQty: new Prisma.Decimal(7),
        },
      ]);

      const vendorProductsForRec1 = [
        {
          id: 201n,
          accountId,
          vendorId: 501n,
          productId: 11n,
          unitCost: new Prisma.Decimal('8.25'),
          minOrderQty: new Prisma.Decimal('12'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ];

      const vendorProductsForRec2 = [
        {
          id: 202n,
          accountId,
          vendorId: 502n,
          productId: 12n,
          unitCost: new Prisma.Decimal('13.75'),
          minOrderQty: new Prisma.Decimal('6'),
          orderMultiple: new Prisma.Decimal('6'),
          isPrimaryVendor: true,
          isActive: true,
        },
      ];

      prismaMock.vendorProduct.findMany
        .mockResolvedValueOnce(vendorProductsForRec1)
        .mockResolvedValueOnce(vendorProductsForRec2);

      vendorProductSelectorMock.select
        .mockReturnValueOnce(vendorProductsForRec1[0])
        .mockReturnValueOnce(vendorProductsForRec2[0]);

      const result = await service.previewRecommendations({
        accountId,
        recommendations: [
          { recommendationId: '101', vendorId: '501', quantity: '5' },
          { recommendationId: '102', vendorId: '502', quantity: '7' },
        ],
      });

      expect(prismaMock.reorderRecommendation.findMany).toHaveBeenCalledWith({
        where: {
          accountId,
          id: { in: [101n, 102n] },
          status: { in: ['open', 'reviewed'] },
        },
        select: {
          id: true,
          productId: true,
          recommendedQty: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      expect(prismaMock.vendorProduct.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          accountId,
          productId: 11n,
          vendorId: 501n,
          isActive: true,
        },
        orderBy: [{ isPrimaryVendor: 'desc' }, { id: 'asc' }],
      });

      expect(prismaMock.vendorProduct.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          accountId,
          productId: 12n,
          vendorId: 502n,
          isActive: true,
        },
        orderBy: [{ isPrimaryVendor: 'desc' }, { id: 'asc' }],
      });

      expect(result).toEqual({
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
          {
            vendorId: '502',
            lineCount: 1,
            totalOrderedQty: '12',
            totalCost: '165.00',
            lines: [
              {
                recommendationId: '102',
                productId: '12',
                vendorProductId: '202',
                recommendedQty: '7',
                finalQty: '12',
                unitCost: '13.75',
                lineTotal: '165.00',
              },
            ],
          },
        ],
        totalGroups: 2,
        totalRecommendations: 2,
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.purchaseOrder.create).not.toHaveBeenCalled();
      expect(txMock.purchaseOrderLine.create).not.toHaveBeenCalled();
      expect(txMock.reorderRecommendation.updateMany).not.toHaveBeenCalled();
    });
    // failure paths
  });
});
