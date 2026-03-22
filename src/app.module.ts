import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { ProcurementModule } from './modules/procurement/procurement.module';


@Module({
  imports: [PrismaModule, 
            ProductsModule, 
            InventoryModule, 
            OrdersModule, 
            VendorsModule, 
            ProcurementModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
