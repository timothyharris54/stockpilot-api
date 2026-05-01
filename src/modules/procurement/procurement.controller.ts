import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecommendationConversionService } from 'src/modules/procurement/services/recommendation-conversion.service';
import { ProcurementService } from 'src/modules/procurement/procurement.service';
import { InventoryBalanceService } from 'src/modules/inventory/services/inventory-balance.service';
import { CreatePurchaseOrderDto } from 'src/modules/procurement/dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from 'src/modules/procurement/dto/receive-purchase-order.dto';
import { SubmitPurchaseOrderDto } from 'src/modules/procurement/dto/submit-purchase-order.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { ConvertRecommendationsDto } from './dto/convert-recommendations.dto';

@Controller('procurement')
@UseGuards(JwtAuthGuard)
@ApiTags('Procurement')
@ApiBearerAuth()
export class ProcurementController {
    constructor(
        private readonly procurementService: ProcurementService,
        private readonly inventoryBalanceService: InventoryBalanceService,
        private readonly conversionService: RecommendationConversionService
    ) {}

    @Post('recommendations/convert')
    async convertRecommendations(
        @CurrentIdentity() identity: RequestIdentity,
        @Body() dto: ConvertRecommendationsDto,

    ) {
        return this.conversionService.convertRecommendations({
            accountId: BigInt(identity.accountId),
            recommendationIds: dto.recommendationIds,
        });
    }
    
    @Post('recommendations/preview')
    async previewRecommendations(
        @CurrentIdentity() identity: RequestIdentity,
        @Body() dto: ConvertRecommendationsDto,

    ) {
        return this.conversionService.previewRecommendations({
            accountId: BigInt(identity.accountId),
            recommendationIds: dto.recommendationIds,
        });
    }
    
    @Post('purchase-order')
    async createPurchaseOrder(
        @CurrentIdentity() identity: RequestIdentity,
        @Body() createPurchaseOrderDto: CreatePurchaseOrderDto
        ) 
        {
            return this.procurementService.createPurchaseOrder(
                { 
                    accountId: identity.accountId, 
                    createPurchaseOrderDto
                });
        }

    @Get('purchase-orders')
    async findAllPurchaseOrders(
        @CurrentIdentity() identity: RequestIdentity
        ) 
        {
            return this.procurementService.findAllPurchaseOrders(identity.accountId);
        }   

    @Get('purchase-order/:id')
    async findPurchaseOrder(
        @CurrentIdentity() identity: RequestIdentity,
        @Param('id') id: string
        ) 
        {
            return this.procurementService.findPurchaseOrder(identity.accountId, id);
        }   


    @Post('purchase-order/:id/submit')
    async submitPurchaseOrder(
            @CurrentIdentity() identity: RequestIdentity,
            @Param('id') id: string,
            @Body() dto: SubmitPurchaseOrderDto
        ) 
        {
            return this.procurementService.submitPurchaseOrder(identity.accountId, id, dto.locationCode);
        }   

    @Post('purchase-order/:id/cancel')
    async cancelPurchaseOrder(
        @CurrentIdentity() identity: RequestIdentity,
        @Param('id') id: string
        )
        {
            return this.procurementService.cancelPurchaseOrder(identity.accountId, id);
        }

    @Post('purchase-order/:id/receive')
    async receivePurchaseOrder(
        @CurrentIdentity() identity: RequestIdentity,
        @Param('id') id: string,
        @Body() receivePurchaseOrderDto: ReceivePurchaseOrderDto,
        ) 
        {
            return this.procurementService.receivePurchaseOrder(identity.accountId, id, receivePurchaseOrderDto);
        }   

}
