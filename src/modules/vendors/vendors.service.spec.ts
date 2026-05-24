import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('VendorsService', () => {
  let service: VendorsService;

  const prismaMock = {
    vendor: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<VendorsService>(VendorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('updates a vendor with account scoping', async () => {
      const existingVendor = {
        id: 10n,
        accountId: 1n,
        name: 'Old Vendor',
      };
      const updateVendorDto = {
        name: 'Updated Vendor',
        contactEmail: 'buyer@example.com',
        defaultLeadTimeDays: 7,
        isActive: true,
      };
      const updatedVendor = {
        ...existingVendor,
        ...updateVendorDto,
      };

      prismaMock.vendor.findFirst.mockResolvedValue(existingVendor);
      prismaMock.vendor.update.mockResolvedValue(updatedVendor);

      const result = await service.update({
        accountId: 1n,
        id: 10n,
        updateVendorDto,
      });

      expect(prismaMock.vendor.findFirst).toHaveBeenCalledWith({
        where: {
          id: 10n,
          accountId: 1n,
        },
      });
      expect(prismaMock.vendor.update).toHaveBeenCalledWith({
        where: {
          id: 10n,
          accountId: 1n,
        },
        data: updateVendorDto,
      });
      expect(result).toEqual(updatedVendor);
    });

    it('throws NotFoundException when the vendor is not in the account', async () => {
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      await expect(
        service.update({
          accountId: 1n,
          id: 10n,
          updateVendorDto: { name: 'Updated Vendor' },
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.vendor.update).not.toHaveBeenCalled();
    });
  });
});
