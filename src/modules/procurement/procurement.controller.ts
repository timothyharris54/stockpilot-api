import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

@Controller('procurement')
export class ProcurementController {
    constructor(private readonly procurementService: ProcurementService) {}

    @Post('purchase-order')
    async createPurchaseOrder(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto) {
        return this.procurementService.createPurchaseOrder(createPurchaseOrderDto);
    }

    @Get('purchase-orders')
    async findAllPurchaseOrders() {
        return this.procurementService.findAllPurchaseOrders();
    }   


    @Post('purchase-order/:id/submit')
    async submitPurchaseOrder(@Param('id') id: string) {
        return this.procurementService.submitPurchaseOrder(id);
    }   

    @Post('purchase-order/:id/receive')
    async receivePurchaseOrder(
        @Param('id') id: string,
        @Body() receivePurchaseOrderDto: ReceivePurchaseOrderDto,
    ) {
        return this.procurementService.receivePurchaseOrder(id, receivePurchaseOrderDto);
    }   

}
