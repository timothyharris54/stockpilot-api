import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class ConvertRecommendationsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  recommendationIds: string[];
}