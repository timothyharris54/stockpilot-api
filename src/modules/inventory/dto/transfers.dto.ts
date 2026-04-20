import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TransfersDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  fromLocationCode!: string;

  @IsString()
  @IsNotEmpty()
  toLocationCode!: string;

  @IsString()
  @IsNotEmpty()
  quantity!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  occurredAt!: string;
}
