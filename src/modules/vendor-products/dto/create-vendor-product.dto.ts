import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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
  unitCost?: string | null;

  @IsOptional()
  @IsNumberString()
  minOrderQty?: string;

  @IsOptional()
  @IsNumberString()
  orderMultiple?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTimeDays?: number | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPrimaryVendor?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
