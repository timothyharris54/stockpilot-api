import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateVendorProductDto {
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  vendorSku?: string;

  @IsOptional()
  @IsNumberString()
  unitCost?: string;

  @IsOptional()
  @IsNumberString()
  minOrderQty?: string;

  @IsOptional()
  @IsNumberString()
  orderMultiple?: string;

  @IsOptional()
  @Type(() => Number)
  leadTimeDays?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPrimaryVendor?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}