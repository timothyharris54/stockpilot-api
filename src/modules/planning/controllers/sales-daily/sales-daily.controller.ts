import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { SalesDailyService } from '../../services/sales-daily.service';
import { RebuildSalesDailyDto } from '../../dto/rebuild-sales-daily.dto';

@Controller()

export class SalesDailyController {
    constructor(private readonly salesDailyService: SalesDailyService) {}

    @Post('sales-daily/rebuild')
    async rebuildForAccount(@Req() req: any, @Body() rebuildDto: RebuildSalesDailyDto) {
        const { accountId } = req.params;
        await this.salesDailyService.rebuildForAccount(accountId, 
            new Date(rebuildDto.from), 
            new Date(rebuildDto.to));
    }

    @Post('sales-daily/rebuild/product/:productId')
    async rebuildForProduct(@Req() req: any, @Body() rebuildDto: RebuildSalesDailyDto) {
        const { accountId } = req.params;
        const { productId } = req.params;
        return this.salesDailyService.rebuildForProduct(accountId, 
            productId, 
            new Date(rebuildDto.from), 
            new Date(rebuildDto.to));
    }   

}
