import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { OpeningBalanceDto } from './dto/opening-balance.dto';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';


@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @UseGuards(JwtAuthGuard)
  @Post('opening-balance')
    async postOpeningBalance(
        @CurrentIdentity() identity: RequestIdentity,
        @Body() openingBalanceDto: OpeningBalanceDto) {
      return this.inventoryService.postOpeningBalance(
        {
          accountId: BigInt(identity.accountId),
          openingBalanceDto
        }
      );
    }
  
  @UseGuards(JwtAuthGuard)
  @Get('balances')
    async getBalances(
      @CurrentIdentity() identity: RequestIdentity,
    ) {
    return this.inventoryService.getBalances(
        BigInt(identity.accountId)
      );
    }

  @UseGuards(JwtAuthGuard)
  @Get('ledger')
    async getLedger(
      @CurrentIdentity() identity: RequestIdentity,
    ) {
      return this.inventoryService.getLedger(BigInt(identity.accountId));
    }
}
