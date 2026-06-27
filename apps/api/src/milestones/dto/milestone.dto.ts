import {
  ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MilestoneInputDto {
  @ApiProperty({ example: 1 })
  @IsInt() @Min(1) order!: number;

  @ApiProperty({ example: 'إنهاء النموذج الأوّلي + بدء التصنيع' })
  @IsString() @MinLength(4) @MaxLength(160)
  titleAr!: string;

  @ApiProperty({ example: 30, description: '% of total raised released at this milestone' })
  @IsInt() @Min(1) @Max(100)
  releasePct!: number;

  @ApiProperty({ example: 'صور النموذج + فاتورة المصنع' })
  @IsString() @MinLength(4)
  evidenceRequired!: string;
}

export class SetMilestonesDto {
  @ApiProperty({ type: [MilestoneInputDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => MilestoneInputDto)
  milestones!: MilestoneInputDto[];
}

export class SubmitEvidenceDto {
  @ApiProperty({ example: 'https://wathba.cdn/evidence/abcd.pdf' })
  @IsUrl() evidenceUrl!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() note?: string;
}

export class CreateSpendLogDto {
  @ApiProperty({ example: 'دفعة المصنّع — الجولة الأولى' })
  @IsString() @MinLength(4) @MaxLength(160)
  descAr!: string;

  @ApiProperty({ example: 46_000_000 })
  @IsInt() @Min(100)
  amountHalalas!: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsUrl() proofUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional() milestoneId?: string;

  @ApiProperty({ required: false, example: '2026-06-20' })
  @IsOptional() @IsString() date?: string;
}
