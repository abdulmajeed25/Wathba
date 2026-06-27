import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectCategory } from '@prisma/client';

export class PlatformStakeDto {
  @ApiProperty({ default: true })
  @IsOptional()
  isPartnered?: true;

  @ApiProperty({ enum: ['equity', 'profit-share', 'co-founder'] })
  @IsString()
  stakeType!: 'equity' | 'profit-share' | 'co-founder';

  @ApiProperty({
    example:
      'تستثمر وثبة في هذا المشروع بصفتها شريكاً مؤسساً، وتشارك أرباح المشروع لاحقاً بشكلٍ منفصل عن دعم المجتمع.',
  })
  @IsString()
  @MinLength(20)
  disclosureAr!: string;
}

export class CreateProjectDto {
  @ApiProperty({ example: 'سِرب — درون التصوير الذكي' })
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  titleAr!: string;

  @ApiProperty({ example: 'كاميرا طائرة تتبعك تلقائياً.' })
  @IsString()
  @MinLength(8)
  @MaxLength(240)
  shortDescAr!: string;

  @ApiProperty({ enum: ProjectCategory })
  @IsEnum(ProjectCategory)
  category!: ProjectCategory;

  @ApiProperty({ example: 'بدأت فكرة المشروع من حاجةٍ بسيطة…' })
  @IsString()
  @MinLength(50)
  storyAr!: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @ApiProperty({ example: 40_000_000, description: 'Funding goal in halalas (1 SAR = 100)' })
  @IsInt()
  @Min(10_000) // 100 SAR
  fundingGoalHalalas!: number;

  @ApiProperty({ example: 80, default: 80, minimum: 50, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  releaseThresholdPct?: number;

  @ApiProperty({ example: 30, minimum: 7, maximum: 90 })
  @IsInt()
  @Min(7)
  @Max(90)
  durationDays!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  productSpecAr?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiProperty({ required: false, type: PlatformStakeDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlatformStakeDto)
  platformPartner?: PlatformStakeDto;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(4) @MaxLength(120) titleAr?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(240) shortDescAr?: string;
  @IsOptional() @IsEnum(ProjectCategory) category?: ProjectCategory;
  @IsOptional() @IsString() @MinLength(50) storyAr?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) mediaUrls?: string[];
  @IsOptional() @IsInt() @Min(10_000) fundingGoalHalalas?: number;
  @IsOptional() @IsInt() @Min(50) @Max(100) releaseThresholdPct?: number;
  @IsOptional() @IsInt() @Min(7) @Max(90) durationDays?: number;
  @IsOptional() @IsString() productSpecAr?: string;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlatformStakeDto)
  platformPartner?: PlatformStakeDto | null;
}

export class ListProjectsQueryDto {
  @ApiProperty({ required: false, enum: ProjectCategory })
  @IsOptional()
  @IsEnum(ProjectCategory)
  category?: ProjectCategory;

  @ApiProperty({ required: false, enum: ['trending', 'new', 'ending_soon', 'most_funded'] })
  @IsOptional()
  @IsString()
  sort?: 'trending' | 'new' | 'ending_soon' | 'most_funded';

  @ApiProperty({ required: false, enum: ['live', 'successful', 'funded', 'all'] })
  @IsOptional()
  @IsString()
  status?: 'live' | 'successful' | 'funded' | 'all';

  /** Include platform-partnered projects? Default true. */
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  includePartnered?: boolean;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  take?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SubmitForReviewDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}
