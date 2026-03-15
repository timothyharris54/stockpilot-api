import { Body, Controller, Get, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { OpeningBalanceDto } from './dto/opening-balance.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('opening-balance')
  postOpeningBalance(@Body() openingBalanceDto: OpeningBalanceDto) {
    return this.inventoryService.postOpeningBalance(openingBalanceDto);
  }

  @Get('balances')
  getBalances() {
    return this.inventoryService.getBalances();
  }

  @Get('ledger')
  getLedger() {
    return this.inventoryService.getLedger();
  }
}
