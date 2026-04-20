import { IsISO8601, IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryEventType } from '@prisma/client';

export class GetLedgerQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  locationCode?: string;

  @IsOptional()
  @IsEnum(InventoryEventType)
  eventType?: InventoryEventType;

  @IsOptional()
  @IsISO8601()
  fromOccurredAt?: string;

  @IsOptional()
  @IsISO8601()
  toOccurredAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}