import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ListCommentsQueryDto {
  /** Top-level filter: omit/empty for top-level comments, UUID for replies of that parent. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  /** Cursor: pass back the last `id` from the prior page to fetch the next slice. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @ApiProperty({ required: false, default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'مشروع رائع! بالتوفيق 🌱' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  bodyAr!: string;

  /** When set, this is a reply to the given comment id. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;
}
