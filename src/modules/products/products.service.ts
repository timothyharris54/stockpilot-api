import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

type ProductInput = {
  accountId: bigint,
  createProductDto: CreateProductDto
}



@Injectable()
export class ProductsService {
  constructor(private readonly prismaService: PrismaService) {}

  create(input: ProductInput) 
  {
    const accountId = BigInt(input.accountId);
    const createProductDto = input.createProductDto;
    
    console.log('Creating product:', createProductDto);
    
    return this.prismaService.product.create({
      data: {
        accountId,
        sku: createProductDto.sku,
        name: createProductDto.name,
      }
    });
  }

  async findAll(accountId: bigint) {
    return this.prismaService.product.findMany({
        where: {
            accountId
        },
        orderBy: { id: 'asc' }
    });
  }

  async find(accountId: bigint, id: bigint) {
    return this.prismaService.product.findFirst({
        where: {
            accountId,
            id
        },
        orderBy: { id: 'asc' }
    });
  }
}
