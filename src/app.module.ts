import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { VendorProductsModule } from './modules/vendor-products/vendor-products.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { PlanningModule } from './modules/planning/planning.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [AuthModule,
            PrismaModule, 
            ProductsModule, 
            InventoryModule, 
            OrdersModule, 
            VendorsModule, 
            VendorProductsModule,
            ProcurementModule,
            PlanningModule
          ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
