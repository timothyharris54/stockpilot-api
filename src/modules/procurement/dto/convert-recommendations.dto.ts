import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class ConvertRecommendationsDto {
  @ApiProperty({
    type: [String],
    example: ['rec_123', 'rec_456'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  recommendationIds!: string[];
}
