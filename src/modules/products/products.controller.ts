import { Body, Controller, Get, Injectable, Post, UseGuards } from '@nestjs/common';
import { ProductsService } from 'src/modules/products/products.service';
import { CreateProductDto } from 'src/modules/products/dto/create-product.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}
  
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() createProductDto: CreateProductDto
  ) {
    return this.productsService.create({
      accountId: BigInt(identity.accountId),
      createProductDto
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @CurrentIdentity() identity: RequestIdentity
  ) {
    return this.productsService.findAll(BigInt(identity.accountId));
  }

  @UseGuards(JwtAuthGuard)
  @Get('byId')
  findById(
    @CurrentIdentity() identity: RequestIdentity,
    productId: string
  ) 
  {
    return this.productsService.find(BigInt(identity.accountId), BigInt(productId));
  }

}
