import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Batch DISC — admin create/update for حملات وثبة collections. */
export class CreateCollectionDto {
  @ApiProperty({ example: 'made-in-saudi' })
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MinLength(3) @MaxLength(60)
  slug!: string;

  @ApiProperty({ example: 'اصنع في السعودية' })
  @IsString() @MinLength(2) @MaxLength(80) nameAr!: string;

  @ApiProperty({ example: 'مشاريع تصنع منتجاتها محلياً.' })
  @IsString() @MinLength(4) @MaxLength(400) descriptionAr!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateCollectionDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) nameAr?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MinLength(4) @MaxLength(400) descriptionAr?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean() showInMenu?: boolean;
  @ApiProperty({ required: false })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class AssignProjectDto {
  @ApiProperty()
  @IsString() projectId!: string;
}
