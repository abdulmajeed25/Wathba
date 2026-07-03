import {
  IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UpdateVisibility } from '@prisma/client';

export class ListUpdatesQueryDto {
  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class CreateUpdateDto {
  @ApiProperty({ example: 'تحديث #3 — وصلت الشحنة الأولى' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleAr!: string;

  @ApiProperty({ example: 'سلام عليكم يا داعمين! وصلت الشحنة الأولى من المصنع…' })
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  bodyAr!: string;

  @ApiProperty({ required: false, enum: UpdateVisibility, default: 'PUBLIC' })
  @IsOptional() @IsEnum(UpdateVisibility)
  visibility?: UpdateVisibility;

  @ApiProperty({ required: false, description: 'Schedule the update for a future time (ISO). Omit to publish now.' })
  @IsOptional() @IsDateString()
  publishAt?: string;
}

export class UpdateUpdateDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleAr?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  bodyAr?: string;

  @ApiProperty({ required: false, enum: UpdateVisibility })
  @IsOptional() @IsEnum(UpdateVisibility)
  visibility?: UpdateVisibility;
}
