import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
}
