import { Module } from '@nestjs/common';
import { VendorProductsController } from './vendor-products.controller';
import { VendorProductsService } from './vendor-products.service';

@Module({
  controllers: [VendorProductsController],
  providers: [VendorProductsService],
  exports: [VendorProductsService],
})
export class VendorProductsModule {}
