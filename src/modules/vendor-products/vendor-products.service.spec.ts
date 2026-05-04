import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { VendorProductsService } from './vendor-products.service';

describe('VendorProductsService', () => {
  let service: VendorProductsService;

  const prismaMock = {
    vendor: {
      findFirst: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    vendorProduct: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorProductsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<VendorProductsService>(VendorProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a vendor product after validating account ownership', async () => {
    prismaMock.vendor.findFirst.mockResolvedValue({ id: 5n, accountId: 1n });
    prismaMock.product.findFirst.mockResolvedValue({ id: 11n, accountId: 1n });
    prismaMock.vendorProduct.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.vendorProduct.create.mockResolvedValue({
      id: 100n,
      accountId: 1n,
      vendorId: 5n,
      productId: 11n,
      isPrimaryVendor: true,
    });

    const result = await service.create(1n, {
      vendorId: '5',
      productId: '11',
      unitCost: '12.50',
      minOrderQty: '2',
      orderMultiple: '1',
      isPrimaryVendor: true,
    });

    expect(prismaMock.vendor.findFirst).toHaveBeenCalledWith({
      where: { accountId: 1n, id: 5n },
    });
    expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
      where: { accountId: 1n, id: 11n },
    });
    expect(prismaMock.vendorProduct.updateMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        productId: 11n,
        isPrimaryVendor: true,
      },
      data: { isPrimaryVendor: false },
    });
    expect(prismaMock.vendorProduct.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 1n,
        vendorId: 5n,
        productId: 11n,
        unitCost: expect.any(Prisma.Decimal),
        minOrderQty: expect.any(Prisma.Decimal),
        orderMultiple: expect.any(Prisma.Decimal),
        isPrimaryVendor: true,
        isActive: true,
      }),
      include: { vendor: true, product: true },
    });
    expect(result.id).toBe(100n);
  });

  it('throws NotFoundException when the vendor is outside the account', async () => {
    prismaMock.vendor.findFirst.mockResolvedValue(null);
    prismaMock.product.findFirst.mockResolvedValue({ id: 11n, accountId: 1n });

    await expect(
      service.create(1n, { vendorId: '5', productId: '11' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('finds all vendor products for an account', async () => {
    const vendorProducts = [{ id: 100n, accountId: 1n }];
    prismaMock.vendorProduct.findMany.mockResolvedValue(vendorProducts);

    const result = await service.findAll(1n);

    expect(prismaMock.vendorProduct.findMany).toHaveBeenCalledWith({
      where: { accountId: 1n },
      include: { vendor: true, product: true },
      orderBy: [{ vendorId: 'asc' }, { productId: 'asc' }],
    });
    expect(result).toEqual(vendorProducts);
  });

  it('finds vendor products by account and vendor', async () => {
    const vendorProducts = [{ id: 100n, accountId: 1n, vendorId: 5n }];
    prismaMock.vendorProduct.findMany.mockResolvedValue(vendorProducts);

    const result = await service.findByVendor(1n, 5n);

    expect(prismaMock.vendorProduct.findMany).toHaveBeenCalledWith({
      where: { accountId: 1n, vendorId: 5n },
      include: { vendor: true, product: true },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    });
    expect(result).toEqual(vendorProducts);
  });

  it('finds vendor products by account and product', async () => {
    const vendorProducts = [{ id: 100n, accountId: 1n, productId: 11n }];
    prismaMock.vendorProduct.findMany.mockResolvedValue(vendorProducts);

    const result = await service.findByProduct(1n, 11n);

    expect(prismaMock.vendorProduct.findMany).toHaveBeenCalledWith({
      where: { accountId: 1n, productId: 11n },
      include: { vendor: true, product: true },
      orderBy: [{ isPrimaryVendor: 'desc' }, { vendorId: 'asc' }],
    });
    expect(result).toEqual(vendorProducts);
  });

  it('finds one vendor product by account and id', async () => {
    const vendorProduct = { id: 100n, accountId: 1n };
    prismaMock.vendorProduct.findFirst.mockResolvedValue(vendorProduct);

    const result = await service.findOne(1n, 100n);

    expect(prismaMock.vendorProduct.findFirst).toHaveBeenCalledWith({
      where: { accountId: 1n, id: 100n },
      include: { vendor: true, product: true },
    });
    expect(result).toEqual(vendorProduct);
  });

  it('throws NotFoundException when a vendor product is not in the account', async () => {
    prismaMock.vendorProduct.findFirst.mockResolvedValue(null);

    await expect(service.findOne(1n, 100n)).rejects.toThrow(NotFoundException);
  });

  it('updates a vendor product with account scoping', async () => {
    prismaMock.vendorProduct.findFirst.mockResolvedValue({
      id: 100n,
      accountId: 1n,
      vendorId: 5n,
      productId: 11n,
    });
    prismaMock.vendorProduct.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.vendorProduct.update.mockResolvedValue({
      id: 100n,
      accountId: 1n,
      isPrimaryVendor: true,
    });

    const result = await service.update(1n, 100n, {
      unitCost: null,
      isPrimaryVendor: true,
    });

    expect(prismaMock.vendorProduct.updateMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        productId: 11n,
        isPrimaryVendor: true,
        id: { not: 100n },
      },
      data: { isPrimaryVendor: false },
    });
    expect(prismaMock.vendorProduct.update).toHaveBeenCalledWith({
      where: { id: 100n },
      data: expect.objectContaining({
        unitCost: null,
        isPrimaryVendor: true,
      }),
      include: { vendor: true, product: true },
    });
    expect(result.id).toBe(100n);
  });

  it('deletes a vendor product with account scoping', async () => {
    const vendorProduct = { id: 100n, accountId: 1n };
    prismaMock.vendorProduct.findFirst.mockResolvedValue(vendorProduct);
    prismaMock.vendorProduct.delete.mockResolvedValue(vendorProduct);

    const result = await service.remove(1n, 100n);

    expect(prismaMock.vendorProduct.delete).toHaveBeenCalledWith({
      where: { id: 100n },
      include: { vendor: true, product: true },
    });
    expect(result).toEqual(vendorProduct);
  });

  it('maps unique constraint violations to BadRequestException', async () => {
    prismaMock.vendor.findFirst.mockResolvedValue({ id: 5n, accountId: 1n });
    prismaMock.product.findFirst.mockResolvedValue({ id: 11n, accountId: 1n });
    prismaMock.vendorProduct.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(1n, { vendorId: '5', productId: '11' }),
    ).rejects.toThrow(BadRequestException);
  });
});
