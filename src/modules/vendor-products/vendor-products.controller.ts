import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { CreateVendorProductDto } from './dto/create-vendor-product.dto';
import { UpdateVendorProductDto } from './dto/update-vendor-product.dto';
import { VendorProductsService } from './vendor-products.service';

@Controller('vendor-products')
@UseGuards(JwtAuthGuard)
@ApiTags('Vendor Products')
@ApiBearerAuth()
export class VendorProductsController {
  constructor(private readonly vendorProductsService: VendorProductsService) {}

  @Post()
  create(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() dto: CreateVendorProductDto,
  ) {
    return this.vendorProductsService.create(BigInt(identity.accountId), dto);
  }

  @Get()
  findAll(@CurrentIdentity() identity: RequestIdentity) {
    return this.vendorProductsService.findAll(BigInt(identity.accountId));
  }

  @Get('vendor/:vendorId')
  findByVendor(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('vendorId') vendorId: string,
  ) {
    return this.vendorProductsService.findByVendor(
      BigInt(identity.accountId),
      BigInt(vendorId),
    );
  }

  @Get('product/:productId')
  findByProduct(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('productId') productId: string,
  ) {
    return this.vendorProductsService.findByProduct(
      BigInt(identity.accountId),
      BigInt(productId),
    );
  }

  @Get(':id')
  findOne(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.vendorProductsService.findOne(
      BigInt(identity.accountId),
      BigInt(id),
    );
  }

  @Patch(':id')
  update(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
    @Body() dto: UpdateVendorProductDto,
  ) {
    return this.vendorProductsService.update(
      BigInt(identity.accountId),
      BigInt(id),
      dto,
    );
  }

  @Delete(':id')
  remove(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.vendorProductsService.remove(
      BigInt(identity.accountId),
      BigInt(id),
    );
  }
}
