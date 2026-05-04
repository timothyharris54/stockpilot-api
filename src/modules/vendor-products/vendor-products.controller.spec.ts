import { Test, TestingModule } from '@nestjs/testing';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { VendorProductsController } from './vendor-products.controller';
import { VendorProductsService } from './vendor-products.service';

describe('VendorProductsController', () => {
  let controller: VendorProductsController;

  const identity: RequestIdentity = {
    userId: 10n,
    accountId: 1n,
    email: 'test@example.com',
  };

  const vendorProductsServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByVendor: jest.fn(),
    findByProduct: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorProductsController],
      providers: [
        {
          provide: VendorProductsService,
          useValue: vendorProductsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<VendorProductsController>(VendorProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('creates a vendor product with accountId from identity', async () => {
    const dto = {
      vendorId: '5',
      productId: '11',
      unitCost: '12.50',
    };
    const vendorProduct = { id: 100n, accountId: 1n };
    vendorProductsServiceMock.create.mockResolvedValue(vendorProduct);

    const result = await controller.create(identity, dto);

    expect(vendorProductsServiceMock.create).toHaveBeenCalledWith(1n, dto);
    expect(result).toEqual(vendorProduct);
  });

  it('finds all vendor products for the identity account', async () => {
    const vendorProducts = [{ id: 100n, accountId: 1n }];
    vendorProductsServiceMock.findAll.mockResolvedValue(vendorProducts);

    const result = await controller.findAll(identity);

    expect(vendorProductsServiceMock.findAll).toHaveBeenCalledWith(1n);
    expect(result).toEqual(vendorProducts);
  });

  it('finds vendor products by accountId and vendorId', async () => {
    const vendorProducts = [{ id: 100n, accountId: 1n, vendorId: 5n }];
    vendorProductsServiceMock.findByVendor.mockResolvedValue(vendorProducts);

    const result = await controller.findByVendor(identity, '5');

    expect(vendorProductsServiceMock.findByVendor).toHaveBeenCalledWith(1n, 5n);
    expect(result).toEqual(vendorProducts);
  });

  it('finds vendor products by accountId and productId', async () => {
    const vendorProducts = [{ id: 100n, accountId: 1n, productId: 11n }];
    vendorProductsServiceMock.findByProduct.mockResolvedValue(vendorProducts);

    const result = await controller.findByProduct(identity, '11');

    expect(vendorProductsServiceMock.findByProduct).toHaveBeenCalledWith(
      1n,
      11n,
    );
    expect(result).toEqual(vendorProducts);
  });

  it('finds one vendor product by accountId and vendorProductId', async () => {
    const vendorProduct = { id: 100n, accountId: 1n };
    vendorProductsServiceMock.findOne.mockResolvedValue(vendorProduct);

    const result = await controller.findOne(identity, '100');

    expect(vendorProductsServiceMock.findOne).toHaveBeenCalledWith(1n, 100n);
    expect(result).toEqual(vendorProduct);
  });

  it('updates one vendor product by accountId and vendorProductId', async () => {
    const dto = { isActive: false };
    const vendorProduct = { id: 100n, accountId: 1n, isActive: false };
    vendorProductsServiceMock.update.mockResolvedValue(vendorProduct);

    const result = await controller.update(identity, '100', dto);

    expect(vendorProductsServiceMock.update).toHaveBeenCalledWith(
      1n,
      100n,
      dto,
    );
    expect(result).toEqual(vendorProduct);
  });

  it('removes one vendor product by accountId and vendorProductId', async () => {
    const vendorProduct = { id: 100n, accountId: 1n };
    vendorProductsServiceMock.remove.mockResolvedValue(vendorProduct);

    const result = await controller.remove(identity, '100');

    expect(vendorProductsServiceMock.remove).toHaveBeenCalledWith(1n, 100n);
    expect(result).toEqual(vendorProduct);
  });
});
