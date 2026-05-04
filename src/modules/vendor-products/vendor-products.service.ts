import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateVendorProductDto } from './dto/create-vendor-product.dto';
import { UpdateVendorProductDto } from './dto/update-vendor-product.dto';

@Injectable()
export class VendorProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(accountId: bigint, dto: CreateVendorProductDto) {
    const vendorId = BigInt(dto.vendorId);
    const productId = BigInt(dto.productId);

    await this.ensureVendorAndProduct(accountId, vendorId, productId);

    if (dto.isPrimaryVendor) {
      await this.clearPrimaryVendor(accountId, productId);
    }

    try {
      return await this.prisma.vendorProduct.create({
        data: {
          accountId,
          vendorId,
          productId,
          vendorSku: dto.vendorSku,
          unitCost:
            dto.unitCost === undefined || dto.unitCost === null
              ? undefined
              : new Prisma.Decimal(dto.unitCost),
          minOrderQty:
            dto.minOrderQty === undefined
              ? new Prisma.Decimal(0)
              : new Prisma.Decimal(dto.minOrderQty),
          orderMultiple:
            dto.orderMultiple === undefined
              ? new Prisma.Decimal(1)
              : new Prisma.Decimal(dto.orderMultiple),
          leadTimeDays: dto.leadTimeDays,
          isPrimaryVendor: dto.isPrimaryVendor ?? false,
          isActive: dto.isActive ?? true,
        },
        include: this.includeRelations(),
      });
    } catch (error) {
      this.handleKnownPrismaError(error);
      throw error;
    }
  }

  findAll(accountId: bigint) {
    return this.prisma.vendorProduct.findMany({
      where: { accountId },
      include: this.includeRelations(),
      orderBy: [{ vendorId: 'asc' }, { productId: 'asc' }],
    });
  }

  findByVendor(accountId: bigint, vendorId: bigint) {
    return this.prisma.vendorProduct.findMany({
      where: { accountId, vendorId },
      include: this.includeRelations(),
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    });
  }

  findByProduct(accountId: bigint, productId: bigint) {
    return this.prisma.vendorProduct.findMany({
      where: { accountId, productId },
      include: this.includeRelations(),
      orderBy: [{ isPrimaryVendor: 'desc' }, { vendorId: 'asc' }],
    });
  }

  async findOne(accountId: bigint, id: bigint) {
    const vendorProduct = await this.prisma.vendorProduct.findFirst({
      where: { accountId, id },
      include: this.includeRelations(),
    });

    if (!vendorProduct) {
      throw new NotFoundException('Vendor product not found');
    }

    return vendorProduct;
  }

  async update(accountId: bigint, id: bigint, dto: UpdateVendorProductDto) {
    const existing = await this.findOne(accountId, id);
    const vendorId =
      dto.vendorId === undefined ? existing.vendorId : BigInt(dto.vendorId);
    const productId =
      dto.productId === undefined ? existing.productId : BigInt(dto.productId);

    if (dto.vendorId !== undefined || dto.productId !== undefined) {
      await this.ensureVendorAndProduct(accountId, vendorId, productId);
    }

    if (dto.isPrimaryVendor === true) {
      await this.clearPrimaryVendor(accountId, productId, id);
    }

    try {
      return await this.prisma.vendorProduct.update({
        where: { id },
        data: {
          vendorId: dto.vendorId === undefined ? undefined : vendorId,
          productId: dto.productId === undefined ? undefined : productId,
          vendorSku: dto.vendorSku,
          unitCost:
            dto.unitCost === undefined
              ? undefined
              : dto.unitCost === null
                ? null
                : new Prisma.Decimal(dto.unitCost),
          minOrderQty:
            dto.minOrderQty === undefined
              ? undefined
              : new Prisma.Decimal(dto.minOrderQty),
          orderMultiple:
            dto.orderMultiple === undefined
              ? undefined
              : new Prisma.Decimal(dto.orderMultiple),
          leadTimeDays: dto.leadTimeDays,
          isPrimaryVendor: dto.isPrimaryVendor,
          isActive: dto.isActive,
        },
        include: this.includeRelations(),
      });
    } catch (error) {
      this.handleKnownPrismaError(error);
      throw error;
    }
  }

  async remove(accountId: bigint, id: bigint) {
    await this.findOne(accountId, id);

    return this.prisma.vendorProduct.delete({
      where: { id },
      include: this.includeRelations(),
    });
  }

  private async ensureVendorAndProduct(
    accountId: bigint,
    vendorId: bigint,
    productId: bigint,
  ) {
    const [vendor, product] = await Promise.all([
      this.prisma.vendor.findFirst({ where: { accountId, id: vendorId } }),
      this.prisma.product.findFirst({ where: { accountId, id: productId } }),
    ]);

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private clearPrimaryVendor(
    accountId: bigint,
    productId: bigint,
    excludeId?: bigint,
  ) {
    return this.prisma.vendorProduct.updateMany({
      where: {
        accountId,
        productId,
        isPrimaryVendor: true,
        ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
      },
      data: { isPrimaryVendor: false },
    });
  }

  private includeRelations() {
    return {
      vendor: true,
      product: true,
    };
  }

  private handleKnownPrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(
        'This vendor/product mapping already exists for the account',
      );
    }
  }
}
