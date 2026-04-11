import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { CreateVendorProductDto } from './dto/create-vendor-product.dto';

type VendorInput = {
  accountId: bigint,
  createVendorDto: CreateVendorDto
}
type VendorProductInput = {
  accountId: bigint,
  createVendorProductDto: CreateVendorProductDto
}

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: VendorInput) {
    const accountId = input.accountId;
    const dto = input.createVendorDto;

    return this.prisma.vendor.create({  // Changed to lowercase
      data: {
        accountId,
        name: dto.name,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        defaultLeadTimeDays: dto.defaultLeadTimeDays,
        paymentTerms: dto.paymentTerms,
        isActive: dto.isActive ?? true,
        notes: dto.notes,
      },
    });
  }

  async findAll(accountId: bigint) {
    
    return this.prisma.vendor.findMany({  // Changed to lowercase
      where: {
        accountId,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async createVendorProduct(input: VendorProductInput) {
    const accountId = input.accountId;
    const dto = input.createVendorProductDto;
    const vendorId = BigInt(dto.vendorId);
    const productId = BigInt(dto.productId);

    const [vendor, product] = await Promise.all([
      this.prisma.vendor.findFirst({  // Changed to lowercase
        where: {
          id: vendorId,
          accountId,
        },
      }),
      this.prisma.product.findFirst({  // Changed to lowercase
        where: {
          id: productId,
          accountId,
        },
      }),
    ]);

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.isPrimaryVendor) {
      await this.prisma.vendorProduct.updateMany({  // Changed to lowercase
        where: {
          accountId,
          productId,
          isPrimaryVendor: true,
        },
        data: {
          isPrimaryVendor: false,
        },
      });
    }

    try {
      return await this.prisma.vendorProduct.create({  // Changed to lowercase
        data: {
          accountId,
          vendorId,
          productId,
          vendorSku: dto.vendorSku,
          unitCost: dto.unitCost ? new Prisma.Decimal(dto.unitCost) : undefined,
          minOrderQty: dto.minOrderQty
            ? new Prisma.Decimal(dto.minOrderQty)
            : new Prisma.Decimal(0),
          orderMultiple: dto.orderMultiple
            ? new Prisma.Decimal(dto.orderMultiple)
            : new Prisma.Decimal(1),
          leadTimeDays: dto.leadTimeDays,
          isPrimaryVendor: dto.isPrimaryVendor ?? false,
          isActive: dto.isActive ?? true,
        },
        include: {
          vendor: true,
          product: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'This vendor/product mapping already exists for the account',
        );
      }
      throw error;
    }
  }

  async findAllVendorProducts(accountId: bigint) {

    return this.prisma.vendorProduct.findMany({  // Changed to lowercase
      where: {
        accountId,
      },
      include: {
        vendor: true,
        product: true,
      },
      orderBy: [{ vendorId: 'asc' }, { productId: 'asc' }],
    });
  }
}