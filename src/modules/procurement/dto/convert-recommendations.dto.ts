import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ConvertRecommendationItemDto } from './convert-recommendations-item.dto';
import { IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';

export class ConvertRecommendationsDto {
  @ApiProperty({
    type: () => ConvertRecommendationItemDto,
    isArray: true,
    example: [
      {
        recommendationId: '101',
        vendorId: '501',
        quantity: '12',
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ConvertRecommendationItemDto)
  recommendations!: ConvertRecommendationItemDto[];
}
