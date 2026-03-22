import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ReceivePurchaseOrderLineDto {
  @IsString()
  @IsNotEmpty()
  purchaseOrderLineId!: string;

  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @IsNumberString()
  receivedQty!: string;

  @IsOptional()
  @IsString()
  @IsNumberString()
  unitCost?: string;
}

export class ReceivePurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  locationCode!: string;

  @IsDateString()
  receivedAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderLineDto)
  lines!: ReceivePurchaseOrderLineDto[];
}