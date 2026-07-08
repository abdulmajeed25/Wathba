import {
  IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional,
  IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectCategory, ProjectRegion } from '@prisma/client';

/** Batch CAT — discovery filters (the mega-menu "تصفية حسب" list). One at a
 *  time, each combinable with category/subcategory + cursor. `upcoming` is
 *  intentionally omitted (scheduled-launch discovery is deferred). */
export const DISCOVERY_FILTERS = [
  'trending',
  'nearly_funded',
  'just_launched',
  'near_you',
  'staff_pick',
] as const;
export type DiscoveryFilter = (typeof DISCOVERY_FILTERS)[number];

/** CC-11 — post-launch story/media edit (writes a public change-log entry). */
export class UpdateStoryDto {
  @ApiProperty({ example: 'قصة المشروع المحدّثة…' })
  @IsString() @MinLength(200) @MaxLength(20000)
  storyAr!: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  mediaUrls?: string[];

  @ApiProperty({ required: false, description: 'Optional creator note describing what changed (shown to backers).' })
  @IsOptional() @IsString() @MaxLength(280)
  changeNote?: string;
}

export class PlatformStakeDto {
  @ApiProperty({ default: true })
  @IsOptional()
  isPartnered?: true;

  @ApiProperty({ enum: ['equity', 'profit-share', 'co-founder'] })
  @IsString()
  stakeType!: 'equity' | 'profit-share' | 'co-founder';

  @ApiProperty()
  @IsString() @MinLength(20)
  disclosureAr!: string;
}

export class CreateProjectDto {
  @ApiProperty({ example: 'سِرب — درون التصوير الذكي' })
  @IsString() @MinLength(4) @MaxLength(120)
  titleAr!: string;

  @ApiProperty({ example: 'كاميرا طائرة تتبعك تلقائياً.' })
  @IsString() @MinLength(8) @MaxLength(240)
  shortDescAr!: string;

  /** LEGACY flat enum — still accepted for back-compat. Prefer categoryId. */
  @ApiProperty({ enum: ProjectCategory, required: false })
  @IsOptional() @IsEnum(ProjectCategory)
  category?: ProjectCategory;

  /** Batch CAT — canonical taxonomy node (top-level or subcategory). The
   *  two-level wizard sends this; the service derives the legacy enum from it. */
  @ApiProperty({ required: false, description: 'Category node id (top-level or subcategory).' })
  @IsOptional() @IsString()
  categoryId?: string;

  @ApiProperty()
  @IsString() @MinLength(50)
  storyAr!: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional() @IsArray() @IsString({ each: true })
  mediaUrls?: string[];

  @ApiProperty({ example: 40_000_000, description: 'Funding goal in halalas (1 SAR = 100)' })
  @IsInt() @Min(10_000)
  fundingGoalHalalas!: number;

  @ApiProperty({ example: 80, default: 80, minimum: 50, maximum: 100 })
  @IsOptional() @IsInt() @Min(50) @Max(100)
  releaseThresholdPct?: number;

  @ApiProperty({ example: 30, minimum: 7, maximum: 90 })
  @IsInt() @Min(7) @Max(90)
  durationDays!: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  productSpecAr?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  expectedDeliveryDate?: string;

  @ApiProperty({ required: false, type: PlatformStakeDto })
  @IsOptional() @IsObject() @ValidateNested()
  @Type(() => PlatformStakeDto)
  platformPartner?: PlatformStakeDto;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(4) @MaxLength(120) titleAr?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(240) shortDescAr?: string;
  @IsOptional() @IsEnum(ProjectCategory) category?: ProjectCategory;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() @MinLength(50) storyAr?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) mediaUrls?: string[];
  @IsOptional() @IsInt() @Min(10_000) fundingGoalHalalas?: number;
  @IsOptional() @IsInt() @Min(50) @Max(100) releaseThresholdPct?: number;
  @IsOptional() @IsInt() @Min(7) @Max(90) durationDays?: number;
  @IsOptional() @IsString() productSpecAr?: string;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;

  // CC-22 — SEO/social. slug is a-z0-9 + hyphens; ogImage a URL; meta a summary.
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug: أحرف إنجليزية صغيرة وأرقام وشرطات فقط' }) @MinLength(3) @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) ogImage?: string;
  @IsOptional() @IsString() @MaxLength(300) metaDescription?: string;
  // CC-20 — proposed go-live time (applied by admin approval).
  @IsOptional() @IsDateString() scheduledLaunchAt?: string | null;

  @IsOptional() @IsObject() @ValidateNested()
  @Type(() => PlatformStakeDto)
  platformPartner?: PlatformStakeDto | null;
}

export class ListProjectsQueryDto {
  @ApiProperty({ required: false, enum: ProjectCategory, description: 'LEGACY flat enum (back-compat). Prefer categorySlug.' })
  @IsOptional() @IsEnum(ProjectCategory)
  category?: ProjectCategory;

  /** Batch CAT — canonical top-level category slug (includes its subcategories). */
  @ApiProperty({ required: false, example: 'technology' })
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  categorySlug?: string;

  /** Batch CAT — subcategory slug within `categorySlug` (narrows to that node only). */
  @ApiProperty({ required: false, example: 'apps' })
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  subSlug?: string;

  /** Batch CAT — a single discovery filter (the "تصفية حسب" links). */
  @ApiProperty({ required: false, enum: DISCOVERY_FILTERS })
  @IsOptional() @IsEnum(DISCOVERY_FILTERS as unknown as object)
  filter?: DiscoveryFilter;

  /** Batch CAT — Saudi region for the "near you" filter / location facet. */
  @ApiProperty({ required: false, enum: ProjectRegion })
  @IsOptional() @IsEnum(ProjectRegion)
  region?: ProjectRegion;

  @ApiProperty({ required: false, enum: ['trending', 'new', 'ending_soon', 'most_funded'] })
  @IsOptional() @IsString()
  sort?: 'trending' | 'new' | 'ending_soon' | 'most_funded';

  @ApiProperty({ required: false, enum: ['live', 'successful', 'funded', 'all'] })
  @IsOptional() @IsString()
  status?: 'live' | 'successful' | 'funded' | 'all';

  /** §7 — Include platform-partnered projects? Default true. */
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  includePartnered?: boolean;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional() @IsInt() @Min(1) @Max(60)
  take?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  cursor?: string;
}

export class SubmitForReviewDto {
  @IsOptional() @IsString() @IsNotEmpty()
  note?: string;
}

/** STAKES/K3 — optional free-text reason on a project report. */
export class ReportProjectDto {
  @ApiProperty({ required: false, example: 'محتوى مضلل' })
  @IsOptional() @IsString() @MaxLength(500)
  reasonAr?: string;
}
