import { Body, Controller, Get, Post, Req, UseGuards} from '@nestjs/common';
import { SalesDailyService } from '../../services/sales-daily.service';
import { RebuildSalesDailyDto } from '../../dto/rebuild-sales-daily.dto';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@Controller()

export class SalesDailyController {
    constructor(private readonly salesDailyService: SalesDailyService) {}

    @UseGuards(JwtAuthGuard)
    @Post('sales-daily/rebuild')
    async rebuildForAccount(
        @CurrentIdentity() identity: RequestIdentity,
        @Body() rebuildDto: RebuildSalesDailyDto
        ) 
    {
        await this.salesDailyService.rebuildForAccount(identity.accountId, 
            new Date(rebuildDto.from), 
            new Date(rebuildDto.to));
    }

    @UseGuards(JwtAuthGuard)
    @Post('sales-daily/rebuild/product/:productId')
    async rebuildForProduct(
            @CurrentIdentity() identity: RequestIdentity,
            @Req() req: any,
            @Body() rebuildDto: RebuildSalesDailyDto
        ) 
    {

        const accountId  = identity.accountId;
        const { productId } = req.params;
        return this.salesDailyService.rebuildForProduct(
            accountId, 
            productId, 
            new Date(rebuildDto.from), 
            new Date(rebuildDto.to)
        );
    }   

}
