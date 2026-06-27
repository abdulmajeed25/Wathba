import {
  IsBoolean, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @IsOptional() @IsInt() sortOrder?: number;
}
