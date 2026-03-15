import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prismaService: PrismaService) {}

  create(createProductDto: CreateProductDto) {
    console.log('Creating product:', createProductDto);
    return this.prismaService.product.create({
      data: createProductDto
    });
  }

  findAll() {
    return this.prismaService.product.findMany({
        orderBy: { id: 'asc' }
    });
  }
}
