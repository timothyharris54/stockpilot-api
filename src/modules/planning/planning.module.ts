import { Module } from '@nestjs/common';
import { SalesDailyService } from './services/sales-daily.service';
import { PlanningSettingsService } from './services/planning-settings.service';
import { SalesDailyController } from './controllers/sales-daily/sales-daily.controller';
import { PrismaModule } from 'src/common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PlanningSettingsService,SalesDailyService],
  controllers: [SalesDailyController],
  exports: [PlanningSettingsService, SalesDailyService]
})


export class PlanningModule {}
