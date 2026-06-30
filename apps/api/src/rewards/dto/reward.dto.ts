import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString,
  Length, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** One "ما يتضمنه" line item in a reward tier. */
export class RewardIncludedItemDto {
  @IsString() @MinLength(1) @MaxLength(80) nameAr!: string;
  @IsOptional() @IsInt() @Min(1) qty?: number;
  @IsOptional() @IsString() @MaxLength(400) thumbnailUrl?: string;
}

export class CreateRewardTierDto {
  @ApiProperty({ example: 'الإصدار المبكر' })
  @IsString() @MinLength(2) @MaxLength(80) titleAr!: string;

  @ApiProperty({ example: 75_000, description: 'Halalas (1 SAR = 100)' })
  @IsInt() @Min(100) amountHalalas!: number;

  @ApiProperty({ example: 'احصل على المنتج بسعر مخفّض، وشحن مجاني داخل الخليج.' })
  @IsString() @MinLength(8) descAr!: string;

  @ApiProperty({ default: false })
  @IsOptional() @IsBoolean() includesPhysicalProduct?: boolean;

  @ApiProperty({ default: false })
  @IsOptional() @IsBoolean() requiresShipping?: boolean;

  @ApiProperty({ example: '2026-12-15' })
  @IsDateString() estDeliveryDate!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsInt() @Min(1) limitQty?: number;

  @ApiProperty({ default: false })
  @IsOptional() @IsBoolean() popular?: boolean;

  @ApiProperty({ default: false, description: 'Show with "مميّزة" badge.' })
  @IsOptional() @IsBoolean() featured?: boolean;

  @ApiProperty({
    required: false,
    type: [RewardIncludedItemDto],
    description: 'Line items shown under "ما يتضمنه".',
  })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => RewardIncludedItemDto)
  includedItems?: RewardIncludedItemDto[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'ISO-3166-1 alpha-2 country codes ("SA", "AE"…).',
  })
  @IsOptional() @IsArray() @ArrayMaxSize(60)
  @IsString({ each: true }) @Length(2, 2, { each: true })
  shipsTo?: string[];

  @ApiProperty({ default: 0 })
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateRewardTierDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) titleAr?: string;
  @IsOptional() @IsInt() @Min(100) amountHalalas?: number;
  @IsOptional() @IsString() @MinLength(8) descAr?: string;
  @IsOptional() @IsBoolean() includesPhysicalProduct?: boolean;
  @IsOptional() @IsBoolean() requiresShipping?: boolean;
  @IsOptional() @IsDateString() estDeliveryDate?: string;
  @IsOptional() @IsInt() @Min(1) limitQty?: number | null;
  @IsOptional() @IsBoolean() popular?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => RewardIncludedItemDto)
  includedItems?: RewardIncludedItemDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(60)
  @IsString({ each: true }) @Length(2, 2, { each: true })
  shipsTo?: string[];
  @IsOptional() @IsInt() sortOrder?: number;
}
