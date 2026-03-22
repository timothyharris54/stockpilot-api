import { Body, Controller, Get, Post } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { CreateVendorProductDto } from './dto/create-vendor-product.dto';

@Controller()
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

@Post('vendors')
    create(@Body() createVendorDto: CreateVendorDto) {
        return this.vendorsService.create(createVendorDto);
    }   

@Get('vendors')
    findAll() {
        return this.vendorsService.findAll();
    }

@Post('vendor-products')
    createVendorProduct(@Body() createVendorProductDto: CreateVendorProductDto) {
        return this.vendorsService.createVendorProduct(createVendorProductDto);
    }

@Get('vendor-products')
    findVendorProducts() {
        return this.vendorsService.findAllVendorProducts();    
    }
}
