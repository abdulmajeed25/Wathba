import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Shared cursor pagination (Sprint 4 / P1-403). */
export class CursorQueryDto {
  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  take?: number;

  @ApiProperty({ required: false, description: 'id of the last row of the previous page' })
  @IsOptional() @IsUUID()
  cursor?: string;
}
