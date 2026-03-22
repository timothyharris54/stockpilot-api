import { Module } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  providers: [ProcurementService],
  controllers: [ProcurementController],
  imports: [InventoryModule],
  exports: [ProcurementService],
})

export class ProcurementModule {}
