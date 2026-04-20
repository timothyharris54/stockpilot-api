import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RecommendationConversionService } from 'src/modules/procurement/services/recommendation-conversion.service';
import { VendorProductSelectorService } from 'src/modules/procurement/services/vendor-product-selector.service';

describe('RecommendationConversionService (integration)', () => {
  let prisma: PrismaService;
  let service: RecommendationConversionService;
  let createdAccountIds: bigint[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        VendorProductSelectorService,
        RecommendationConversionService,
      ],
    }).compile();

    prisma = module.get(PrismaService);
    service = module.get(RecommendationConversionService);

    await prisma.$connect();
  });

  beforeEach(() => {
    createdAccountIds = [];
  });

  afterEach(async () => {
    if (createdAccountIds.length > 0) {
      await prisma.account.deleteMany({
        where: {
          id: {
            in: createdAccountIds,
          },
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allocates sequential PO numbers per account across multiple conversions', async () => {
    const account = await prisma.account.create({
      data: {
        name: 'Procurement Integration Account',
      },
    });
    createdAccountIds.push(account.id);

    const vendor = await prisma.vendor.create({
      data: {
        accountId: account.id,
        name: 'Vendor A',
      },
    });

    const product1 = await prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'SEQ-1',
        name: 'Sequence Product 1',
      },
    });

    const product2 = await prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'SEQ-2',
        name: 'Sequence Product 2',
      },
    });

    const vendorProduct1 = await prisma.vendorProduct.create({
      data: {
        accountId: account.id,
        vendorId: vendor.id,
        productId: product1.id,
        unitCost: '8.25',
        minOrderQty: '12.00',
        orderMultiple: '6.00',
        isPrimaryVendor: true,
        isActive: true,
      },
    });

    const vendorProduct2 = await prisma.vendorProduct.create({
      data: {
        accountId: account.id,
        vendorId: vendor.id,
        productId: product2.id,
        unitCost: '13.75',
        minOrderQty: '6.00',
        orderMultiple: '6.00',
        isPrimaryVendor: true,
        isActive: true,
      },
    });

    const recommendation1 = await prisma.reorderRecommendation.create({
      data: {
        accountId: account.id,
        productId: product1.id,
        locationCode: 'MAIN',
        recommendedQty: '5.00',
        status: 'open',
      },
    });

    const recommendation2 = await prisma.reorderRecommendation.create({
      data: {
        accountId: account.id,
        productId: product2.id,
        locationCode: 'MAIN',
        recommendedQty: '7.00',
        status: 'reviewed',
      },
    });

    const firstResult = await service.convertRecommendations({
      accountId: account.id,
      recommendationIds: [recommendation1.id.toString()],
    });

    const secondResult = await service.convertRecommendations({
      accountId: account.id,
      recommendationIds: [recommendation2.id.toString()],
    });

    expect(firstResult.purchaseOrders).toHaveLength(1);
    expect(firstResult.purchaseOrders[0].purchaseOrderId).toBeDefined();
    expect(secondResult.purchaseOrders).toHaveLength(1);
    expect(secondResult.purchaseOrders[0].purchaseOrderId).toBeDefined();

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        accountId: account.id,
      },
      orderBy: {
        id: 'asc',
      },
      include: {
        lines: true,
      },
    });

    expect(purchaseOrders).toHaveLength(2);
    expect(purchaseOrders[0].poNumber).toBe('PO-001000');
    expect(purchaseOrders[0].vendorId).toBe(vendor.id);
    expect(purchaseOrders[1].poNumber).toBe('PO-001001');
    expect(purchaseOrders[1].vendorId).toBe(vendor.id);

    expect(purchaseOrders[0].lines).toHaveLength(1);
    expect(purchaseOrders[0].lines[0].vendorProductId).toBe(vendorProduct1.id);
    expect(Number(purchaseOrders[0].lines[0].orderedQty)).toBe(12);

    expect(purchaseOrders[1].lines).toHaveLength(1);
    expect(purchaseOrders[1].lines[0].vendorProductId).toBe(vendorProduct2.id);
    expect(Number(purchaseOrders[1].lines[0].orderedQty)).toBe(12);

    const refreshedAccount = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
      select: {
        nextPurchaseOrderNumber: true,
      },
    });

    expect(refreshedAccount.nextPurchaseOrderNumber).toBe(1002);
  });

  it('maintains an independent PO sequence per account', async () => {
    const accountA = await prisma.account.create({
      data: {
        name: 'Procurement Account A',
      },
    });
    createdAccountIds.push(accountA.id);

    const accountB = await prisma.account.create({
      data: {
        name: 'Procurement Account B',
      },
    });
    createdAccountIds.push(accountB.id);

    const vendorA = await prisma.vendor.create({
      data: {
        accountId: accountA.id,
        name: 'Vendor A',
      },
    });

    const vendorB = await prisma.vendor.create({
      data: {
        accountId: accountB.id,
        name: 'Vendor B',
      },
    });

    const productA = await prisma.product.create({
      data: {
        accountId: accountA.id,
        sku: 'ACCTA-1',
        name: 'Account A Product',
      },
    });

    const productB = await prisma.product.create({
      data: {
        accountId: accountB.id,
        sku: 'ACCTB-1',
        name: 'Account B Product',
      },
    });

    await prisma.vendorProduct.create({
      data: {
        accountId: accountA.id,
        vendorId: vendorA.id,
        productId: productA.id,
        unitCost: '5.00',
        minOrderQty: '10.00',
        orderMultiple: '5.00',
        isPrimaryVendor: true,
        isActive: true,
      },
    });

    await prisma.vendorProduct.create({
      data: {
        accountId: accountB.id,
        vendorId: vendorB.id,
        productId: productB.id,
        unitCost: '6.00',
        minOrderQty: '10.00',
        orderMultiple: '5.00',
        isPrimaryVendor: true,
        isActive: true,
      },
    });

    const recommendationA = await prisma.reorderRecommendation.create({
      data: {
        accountId: accountA.id,
        productId: productA.id,
        locationCode: 'MAIN',
        recommendedQty: '4.00',
        status: 'open',
      },
    });

    const recommendationB = await prisma.reorderRecommendation.create({
      data: {
        accountId: accountB.id,
        productId: productB.id,
        locationCode: 'MAIN',
        recommendedQty: '4.00',
        status: 'open',
      },
    });

    await service.convertRecommendations({
      accountId: accountA.id,
      recommendationIds: [recommendationA.id.toString()],
    });

    await service.convertRecommendations({
      accountId: accountB.id,
      recommendationIds: [recommendationB.id.toString()],
    });

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      orderBy: [{ accountId: 'asc' }, { id: 'asc' }],
      select: {
        accountId: true,
        poNumber: true,
      },
    });

    expect(purchaseOrders).toEqual([
      {
        accountId: accountA.id,
        poNumber: 'PO-001000',
      },
      {
        accountId: accountB.id,
        poNumber: 'PO-001000',
      },
    ]);

    const accounts = await prisma.account.findMany({
      where: {
        id: {
          in: [accountA.id, accountB.id],
        },
      },
      orderBy: {
        id: 'asc',
      },
      select: {
        id: true,
        nextPurchaseOrderNumber: true,
      },
    });

    expect(accounts).toEqual([
      {
        id: accountA.id,
        nextPurchaseOrderNumber: 1001,
      },
      {
        id: accountB.id,
        nextPurchaseOrderNumber: 1001,
      },
    ]);
  });
});
