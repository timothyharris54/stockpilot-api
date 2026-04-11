import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { VendorsService } from 'src/modules/vendors/vendors.service';
import { CreateVendorDto } from 'src/modules/vendors/dto/create-vendor.dto';
import { CreateVendorProductDto } from 'src/modules/vendors/dto/create-vendor-product.dto';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

@UseGuards(JwtAuthGuard)
@Post('vendor')
    async create(
        @CurrentIdentity() identity: RequestIdentity,
        @Body() createVendorDto: CreateVendorDto
    ) {
        return this.vendorsService.create({
            accountId: BigInt(identity.accountId),
            createVendorDto,
        });
    }   

@UseGuards(JwtAuthGuard)
@Get('allVendors')
    findAll(
        @CurrentIdentity() identity: RequestIdentity,
    ) {
        return this.vendorsService.findAll(BigInt(identity.accountId));
    }

@UseGuards(JwtAuthGuard)
@Post('vendor-product')
    createVendorProduct(
        @CurrentIdentity() identity: RequestIdentity,
        @Body() createVendorProductDto: CreateVendorProductDto
    ) {
        return this.vendorsService.createVendorProduct({
            accountId: BigInt(identity.accountId),
            createVendorProductDto,
        });
    }

@UseGuards(JwtAuthGuard)
@Get('vendor-products')
    findVendorProducts(
        @CurrentIdentity() identity: RequestIdentity,
    ) {
        return this.vendorsService.findAllVendorProducts(BigInt(identity.accountId));    
    }
}
