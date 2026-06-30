import {
  IsInt, IsOptional, IsString, MaxLength, Min, MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAddOnDto {
  @ApiProperty({ example: 'حقيبة مخصّصة' })
  @IsString() @MinLength(2) @MaxLength(80) titleAr!: string;

  @ApiProperty({ example: 7500, description: 'Halalas (1 SAR = 100)' })
  @IsInt() @Min(100) amountHalalas!: number;

  @ApiProperty({ example: 'حقيبة كتف بشعار المشروع.' })
  @IsString() @MinLength(8) descAr!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(400) imageUrl?: string;

  @ApiProperty({ required: false, description: 'Max units across all backers (null = unlimited).' })
  @IsOptional() @IsInt() @Min(1) limitQty?: number;

  @ApiProperty({ default: 0 })
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateAddOnDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) titleAr?: string;
  @IsOptional() @IsInt() @Min(100) amountHalalas?: number;
  @IsOptional() @IsString() @MinLength(8) descAr?: string;
  @IsOptional() @IsString() @MaxLength(400) imageUrl?: string;
  @IsOptional() @IsInt() @Min(1) limitQty?: number | null;
  @IsOptional() @IsInt() sortOrder?: number;
}
