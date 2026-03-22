import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { getAccountId } from '../../shared/account-context';


@Injectable()
export class ProductsService {
  constructor(private readonly prismaService: PrismaService) {}

  create(createProductDto: CreateProductDto) {
    console.log('Creating product:', createProductDto);
    return this.prismaService.product.create({
      data: {
        accountId: getAccountId(),
        sku: createProductDto.sku,
        name: createProductDto.name,
      }
    });
  }

  findAll() {
    return this.prismaService.product.findMany({
        where: {
            accountId: getAccountId()
        },
        orderBy: { id: 'asc' }
    });
  }
}
